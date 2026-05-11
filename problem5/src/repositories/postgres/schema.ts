import { pgTable, bigserial, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Source of truth for the Postgres tables.
// Mirrors the SQLite shape so the IItemsRepository contract is identical.
export const items = pgTable(
   'items',
   {
      id: bigserial('id', { mode: 'number' }).primaryKey(),
      name: text('name').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (t) => [
      // Trigram GIN index speeds up case-insensitive substring search
      // (`name ILIKE '%term%'`). Requires the pg_trgm extension; the migration
      // creates it.
      index('items_name_trgm_idx').using('gin', sql`lower(${t.name}) gin_trgm_ops`),
   ]
);

export type ItemRow = typeof items.$inferSelect;
export type NewItemRow = typeof items.$inferInsert;
