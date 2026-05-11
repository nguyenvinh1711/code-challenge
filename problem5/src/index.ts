import path from 'node:path';
import { newApp } from './app';

// Load problem5/.env if present. Optional — silently ignored when missing.
try {
   process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
   /* no .env, fall back to shell env */
}

const port = process.env['PORT'] ?? 3000;
const { app, closeDb } = newApp();

const server = app.listen(port, () => {
   // eslint-disable-next-line no-console
   console.log(`problem5 HTTP Server listening at http://localhost:${port}`);
});

// Simple graceful shutdown. Stop accepting new connections, close DB pools/handles.
function shutdown(signal: string) {
   // eslint-disable-next-line no-console
   console.log(`\nReceived ${signal}, shutting down…`);
   // 1. Stop the server from accepting new connections
   server.close(async () => {
      // 2. Close the DB pools/handles
      await closeDb();
      // 3. Exit the process
      process.exit(0);
   });
   // Hard timeout safety net — don't hang forever if a request is stuck.
   setTimeout(() => process.exit(1), 10_000);
}

// Listen for termination signals and shutdown the server gracefully
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
