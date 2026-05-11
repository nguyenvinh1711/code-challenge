import express, { type Express } from 'express';
import morgan from 'morgan';
import { itemsRouter } from './routes';
import { newItemsService } from './services';
import { loadConfig, buildRepositories } from './config';
import { notFound, errorHandler } from './middleware/errors';

export interface AppHandle {
   app: Express;
   /** Close all DB connections. Call on SIGTERM/SIGINT. */
   closeDb: () => Promise<void>;
}

export function newApp(): AppHandle {
   const app = express();

   // Middleware
   app.use(express.json());

   if (process.env.NODE_ENV !== 'test') {
      // for logging
      app.use(morgan('dev'));
   }

   // Health check
   app.get('/health', (_req, res) => {
      res.json({ ok: true });
   });

   // Build the repository bundle for the configured driver.
   const repos = buildRepositories(loadConfig());
   const itemsService = newItemsService(repos.items);
   // other services can be added here

   // Register routes
   app.use('/items', itemsRouter(itemsService));

   // Error handling
   app.use(notFound);
   app.use(errorHandler);

   return { app, closeDb: () => repos.close() };
}
