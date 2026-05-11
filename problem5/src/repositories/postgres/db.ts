import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type PgPool = Pool;
export type PgDb = NodePgDatabase<typeof schema>;

export interface PgPoolConfig {
   url: string;
   poolConfig?: Partial<PoolConfig>;
}

// Process-scoped pool. Caller (config.ts) keeps a single instance for the
// lifetime of the app.
export function newPgPool(cfg: PgPoolConfig): PgPool {
   return new Pool({
      connectionString: cfg.url,
      max: Number(process.env['PG_POOL_MAX'] ?? 10),
      ...cfg.poolConfig,
   });
}

export function newPgDrizzle(pool: PgPool): PgDb {
   return drizzle(pool, { schema });
}
