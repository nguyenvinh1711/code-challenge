import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// One-shot migration runner. Run as a deploy step, NOT on app boot.
//   DATABASE_URL=postgres://... npx ts-node problem5/src/scripts/migrate.ts
async function main() {
   try {
      process.loadEnvFile(path.join(__dirname, '..', '..', '.env'));
   } catch {
      /* .env optional */
   }

   const url = process.env['DATABASE_URL'];
   if (!url) {
      console.error('DATABASE_URL is required');
      process.exit(1);
   }

   const pool = new Pool({ connectionString: url, max: 1 });
   const db = drizzle(pool);
   const migrationsFolder = path.join(__dirname, '..', '..', 'migrations', 'postgres');
   console.log(`Running migrations from ${migrationsFolder}`);
   await migrate(db, { migrationsFolder });
   await pool.end();
   console.log('Migrations applied.');
}

main().catch((e) => {
   console.error(e);
   process.exit(1);
});
