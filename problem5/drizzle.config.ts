import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

try {
   process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
   /* .env optional */
}

export default defineConfig({
   schema: path.join(__dirname, 'src', 'repositories', 'postgres', 'schema.ts'),
   out: path.join(__dirname, 'migrations', 'postgres'),
   dialect: 'postgresql',
   dbCredentials: {
      url: process.env['DATABASE_URL'] ?? '',
   },
   strict: true,
   verbose: true,
});
