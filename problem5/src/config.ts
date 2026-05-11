import type { IRepositories } from './repositories/interfaces';
import { buildSqliteRepositories } from './repositories/sqlite';
import { buildPostgresRepositories } from './repositories/postgres';

export type DbDriver = 'sqlite' | 'postgres';

export interface AppConfig {
   driver: DbDriver;
   sqlitePath?: string;
   postgresUrl?: string;
}

// Single dispatch point. Adding a new driver = one extra `case`.
// Adding a new repo doesn't touch this file at all — it lives inside
// each driver's `buildXxxRepositories`.
export function buildRepositories(cfg: AppConfig): IRepositories {
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
   const config: AppConfig = { driver: driverEnv };
   const sqlitePath = process.env['DB_PATH'];
   if (sqlitePath) config.sqlitePath = sqlitePath;
   const postgresUrl = process.env['DATABASE_URL'];
   if (postgresUrl) config.postgresUrl = postgresUrl;
   return config;
}
