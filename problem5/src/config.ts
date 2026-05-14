import type { IRepositories } from './repositories/interfaces';
import { buildSqliteRepositories } from './repositories/sqlite';
import { buildPostgresRepositories } from './repositories/postgres';
import { CachingItemsRepository, type CacheTtls } from './repositories/cached';
import { buildCache, type CacheConfig, type CacheDriver } from './cache';

export type DbDriver = 'sqlite' | 'postgres';

export interface AppConfig {
   driver: DbDriver;
   sqlitePath?: string;
   postgresUrl?: string;
   cache: CacheConfig;
}

// Single dispatch point. Adding a new driver = one extra `case`.
// Adding a new repo doesn't touch this file at all — it lives inside
// each driver's `buildXxxRepositories`.
export function buildRepositories(cfg: AppConfig): IRepositories {
   const base = buildBaseRepositories(cfg);
   const cache = buildCache(cfg.cache);
   if (!cache) return base;

   const ttls: CacheTtls = {
      itemMs: cfg.cache.itemTtlMs,
      listMs: cfg.cache.listTtlMs,
      negativeMs: cfg.cache.negativeTtlMs,
   };

   const cachedItems = new CachingItemsRepository(base.items, cache, ttls, cfg.cache.keyPrefix);

   return {
      items: cachedItems,
      close: async () => {
         await cache.close();
         await base.close();
      },
   };
}

function buildBaseRepositories(cfg: AppConfig): IRepositories {
   switch (cfg.driver) {
      case 'sqlite':
         return buildSqliteRepositories({ dbPath: cfg.sqlitePath ?? '' });
      case 'postgres':
         if (!cfg.postgresUrl) {
            throw new Error('DATABASE_URL is required when DB_DRIVER=postgres');
         }
         return buildPostgresRepositories({ url: cfg.postgresUrl });
   }
}

export function loadConfig(): AppConfig {
   const driverEnv = (process.env['DB_DRIVER'] ?? 'sqlite').toLowerCase();
   if (driverEnv !== 'sqlite' && driverEnv !== 'postgres') {
      throw new Error(`Invalid DB_DRIVER='${driverEnv}'. Expected 'sqlite' or 'postgres'.`);
   }
   const config: AppConfig = { driver: driverEnv, cache: loadCacheConfig() };
   const sqlitePath = process.env['DB_PATH'];
   if (sqlitePath) config.sqlitePath = sqlitePath;
   const postgresUrl = process.env['DATABASE_URL'];
   if (postgresUrl) config.postgresUrl = postgresUrl;
   return config;
}

function loadCacheConfig(): CacheConfig {
   // Default to `none` under tests so existing test expectations are unchanged.
   const fallback: CacheDriver = process.env['NODE_ENV'] === 'test' ? 'none' : 'memory';
   const raw = (process.env['CACHE_DRIVER'] ?? fallback).toLowerCase();
   if (raw !== 'memory' && raw !== 'redis' && raw !== 'none') {
      throw new Error(`Invalid CACHE_DRIVER='${raw}'. Expected 'memory', 'redis', or 'none'.`);
   }
   const cfg: CacheConfig = {
      driver: raw,
      itemTtlMs: parseInt(process.env['CACHE_TTL_ITEM_MS'] ?? '60000', 10),
      listTtlMs: parseInt(process.env['CACHE_TTL_LIST_MS'] ?? '30000', 10),
      negativeTtlMs: parseInt(process.env['CACHE_TTL_NEGATIVE_MS'] ?? '5000', 10),
      maxEntries: parseInt(process.env['CACHE_MAX_ENTRIES'] ?? '1000', 10),
      keyPrefix: process.env['CACHE_KEY_PREFIX'] ?? 'p5:',
   };
   const redisUrl = process.env['REDIS_URL'];
   if (redisUrl) cfg.redisUrl = redisUrl;
   return cfg;
}
