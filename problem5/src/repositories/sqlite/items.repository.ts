import type { SqliteDb } from './db';
import type {
   Item,
} from '../../models/items.model';
import type {
   CreateItemInput,
   UpdateItemInput,
   ListItemsFilter,
} from '../../schemas/items.schema';
import type { IItemsRepository } from '../interfaces';

// better-sqlite3 is synchronous; the methods are declared async to satisfy
// the IItemsRepository contract — the sync result is returned via Promise.resolve.
export function newSqliteItemsRepository(db: SqliteDb): IItemsRepository {
   const insertStmt = db.prepare(
      `INSERT INTO items (name, createdAt, updatedAt) VALUES (@name, @createdAt, @updatedAt)`
   );

   async function create(input: CreateItemInput): Promise<Item> {
      const now = new Date().toISOString();
      const info = insertStmt.run({
         name: input.name,
         createdAt: now,
         updatedAt: now,
      });
      return {
         id: Number(info.lastInsertRowid),
         name: input.name,
         createdAt: now,
         updatedAt: now,
      };
   }

   async function list(filter: ListItemsFilter): Promise<{ data: Item[]; total: number }> {
      const whereSql = filter.q !== undefined ? `WHERE name LIKE @q COLLATE NOCASE` : '';
      const params: Record<string, unknown> =
         filter.q !== undefined ? { q: `%${filter.q}%` } : {};

      const totalRow = db
         .prepare(`SELECT COUNT(*) AS c FROM items ${whereSql}`)
         .get(params) as { c: number };

      const orderSql = `ORDER BY ${filter.sortBy} ${filter.order.toUpperCase()}`;
      const offset = (filter.page - 1) * filter.limit;

      const rows = db
         .prepare(
            `SELECT id, name, createdAt, updatedAt FROM items ${whereSql}
            ${orderSql} LIMIT @limit OFFSET @offset`
         )
         .all({ ...params, limit: filter.limit, offset }) as Item[];

      return { data: rows, total: totalRow.c };
   }

   const getStmt = db.prepare(`SELECT id, name, createdAt, updatedAt FROM items WHERE id = ?`);

   async function get(id: number): Promise<Item | undefined> {
      return getStmt.get(id) as Item | undefined;
   }

   const updateTxn = db.transaction((id: number, patch: UpdateItemInput): Item | undefined => {
      const existing = getStmt.get(id) as Item | undefined;
      if (!existing) return undefined;
      const merged: Item = {
         id: existing.id,
         name: patch.name ?? existing.name,
         createdAt: existing.createdAt,
         updatedAt: new Date().toISOString(),
      };
      db.prepare(`UPDATE items SET name=@name, updatedAt=@updatedAt WHERE id=@id`).run(merged);
      return merged;
   });

   async function update(id: number, patch: UpdateItemInput): Promise<Item | undefined> {
      return updateTxn(id, patch);
   }


   const deleteStmt = db.prepare(`DELETE FROM items WHERE id = ?`);

   async function del(id: number): Promise<boolean> {
      const info = deleteStmt.run(id);
      return info.changes > 0;
   }

   return { create, list, get, update, delete: del };
}
