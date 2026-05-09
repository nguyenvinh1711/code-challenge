import path from 'node:path';
import type { Express } from 'express';
import { newApp } from './app';

// Load problem5/.env if present. Optional — silently ignored when missing.
try {
   process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
   /* no .env, fall back to shell env */
}

const port = process.env['PORT'] ?? 3000;
const app: Express = newApp();

app.listen(port, () => {
   // eslint-disable-next-line no-console
   console.log(`problem5 Crude Server listening at http://localhost:${port}`);
});
