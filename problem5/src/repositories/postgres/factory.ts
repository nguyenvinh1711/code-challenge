import type { IRepositories } from '../interfaces';
import { newPgPool, newPgDrizzle, type PgPoolConfig } from './db';
import { newPgItemsRepository } from './items.repository';

// One pg.Pool shared across all Postgres-backed repos. Closing the bundledrains the pool — call this on SIGTERM, never per-request.
export function buildPostgresRepositories(cfg: PgPoolConfig): IRepositories {
   const pool = newPgPool(cfg);
   const db = newPgDrizzle(pool);
   return {
      items: newPgItemsRepository(db),
      // users:  newPgUsersRepository(db),
      close: async () => {
         await pool.end();
      },
   };
}
