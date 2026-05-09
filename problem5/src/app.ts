import express, { type Express } from 'express';
import morgan from 'morgan';
import { itemsRouter } from './routes';
import { newItemsService } from './services';
import { newSqliteDb, newSqliteItemsRepository } from './repositories';
import { notFound, errorHandler } from './middleware/errors';

export function newApp(): Express {
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

   // Connect to db and create services
   const db = newSqliteDb(process.env['DB_PATH']);
   const itemsService = newItemsService(newSqliteItemsRepository(db));

   // Register routes
   app.use('/items', itemsRouter(itemsService));

   // Error handling
   app.use(notFound);
   app.use(errorHandler);

   return app;
}
