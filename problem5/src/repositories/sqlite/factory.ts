import type { IRepositories } from '../interfaces';
import { newSqliteDb, type SqliteConfig } from './db';
import { newSqliteItemsRepository } from './items.repository';

// Factory function to build the SQLite repositories. One DB connection shared across all SQLite-backed repos.
export function buildSqliteRepositories(cfg: SqliteConfig): IRepositories {
   const db = newSqliteDb(cfg);
   return {
      items: newSqliteItemsRepository(db),
      // users:  newSqliteUsersRepository(db),
      close: async () => {
         db.close();
      },
   };
}
