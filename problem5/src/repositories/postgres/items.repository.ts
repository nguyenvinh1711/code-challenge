import { and, count, desc, asc, eq, ilike, type SQL } from 'drizzle-orm';
import type { Item } from '../../models';
import type { CreateItemInput, UpdateItemInput, ListItemsFilter } from '../../schemas';
import type { IItemsRepository } from '../interfaces';
import type { PgDb } from './db';
import { items, type ItemRow } from './schema';

// Map a Drizzle row to the domain Item shape (ISO timestamps).
const rowToItem = (r: ItemRow): Item => ({
   id: r.id,
   name: r.name,
   createdAt: r.createdAt.toISOString(),
   updatedAt: r.updatedAt.toISOString(),
});

const sortColumn = (sortBy: ListItemsFilter['sortBy']) => {
   switch (sortBy) {
      case 'id':
         return items.id;
      case 'name':
         return items.name;
      case 'updatedAt':
         return items.updatedAt;
      case 'createdAt':
      default:
         return items.createdAt;
   }
};

export function newPgItemsRepository(db: PgDb): IItemsRepository {
   async function create(input: CreateItemInput): Promise<Item> {
      const [row] = await db
         .insert(items)
         .values({ name: input.name })
         .returning();
      return rowToItem(row!);
   }

   async function get(id: number): Promise<Item | undefined> {
      const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);
      return row ? rowToItem(row) : undefined;
   }

   async function list(filter: ListItemsFilter): Promise<{ data: Item[]; total: number }> {
      const where: SQL | undefined =
         filter.q !== undefined ? ilike(items.name, `%${filter.q}%`) : undefined;
      const offset = (filter.page - 1) * filter.limit;
      const order = filter.order === 'asc' ? asc(sortColumn(filter.sortBy)) : desc(sortColumn(filter.sortBy));

      // Single transaction so total + page see the same snapshot under
      // concurrent writes.
      return db.transaction(async (tx) => {
         const totals = await tx
            .select({ value: count() })
            .from(items)
            .where(where ?? sql_true());

         const rows = await tx
            .select()
            .from(items)
            .where(where ?? sql_true())
            .orderBy(order)
            .limit(filter.limit)
            .offset(offset);

         return { data: rows.map(rowToItem), total: Number(totals[0]?.value ?? 0) };
      });
   }

   async function update(id: number, patch: UpdateItemInput): Promise<Item | undefined> {
      const [row] = await db
         .update(items)
         .set({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            updatedAt: new Date(),
         })
         .where(eq(items.id, id))
         .returning();
      return row ? rowToItem(row) : undefined;
   }

   async function del(id: number): Promise<boolean> {
      const result = await db
         .delete(items)
         .where(eq(items.id, id))
         .returning({ id: items.id });
      return result.length > 0;
   }

   return { create, list, get, update, delete: del };
}

// `where` argument must always be a SQL expression for Drizzle to keep typed
// builders happy when a filter is absent. AND() with no args returns a no-op.
function sql_true(): SQL {
   // The Drizzle ORM requires a SQL expression for filters, but when no filter is provided,
   // we need an "always-true" expression in SQL so that all rows are returned.
   return and()!;
}
