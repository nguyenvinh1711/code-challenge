import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/http-errors';

export function notFound(_req: Request, res: Response): void {
   res.status(404).json({
      error: { code: 'NotFound', message: 'Route not found' },
   });
}

export function errorHandler(
   err: unknown,
   _req: Request,
   res: Response,
   _next: NextFunction
): void {
   if (err instanceof ApiError) {
      const body: { error: { code: string; message: string; details?: unknown } } = {
         error: { code: err.code, message: err.message },
      };
      if (err.details !== undefined) body.error.details = err.details;
      res.status(err.statusCode).json(body);
      return;
   }
   // eslint-disable-next-line no-console
   console.error('[unhandled]', err);
   res.status(500).json({
      error: { code: 'InternalError', message: 'Internal server error' },
   });
}
