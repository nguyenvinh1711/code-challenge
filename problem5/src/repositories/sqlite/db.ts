import path from 'node:path';
import Database from 'better-sqlite3';

export type SqliteDb = Database.Database;

export function newSqliteDb(dbAbsolutePath?: string): SqliteDb {
   const resolved = dbAbsolutePath?.trim()
      ? dbAbsolutePath
      : path.resolve(__dirname, '../../../data/items.sqlite');

   const db = new Database(resolved, { verbose: console.log });

   // This switches SQLite from its default "Rollback Journal" mode to "Write-Ahead Log" (WAL) mode to improve write concurrency and performance
   if (resolved !== ':memory:') {
      db.pragma('journal_mode = WAL');
   }

   db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      createdAt   TEXT NOT NULL,
      updatedAt   TEXT NOT NULL
    );
  `);

   return db;
}
