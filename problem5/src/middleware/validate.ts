import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from '../utils/http-errors';

export const validate =
   (source: 'body' | 'query' | 'params', schema: ZodSchema) =>
      (req: Request, res: Response, next: NextFunction): void => {
         const r = schema.safeParse(req[source]);
         if (!r.success) {
            next(new ApiError(400, 'ValidationError', 'Invalid request', r.error.flatten()));
            return;
         }
         if (source === 'query') {
            // Express 5: req.query is a getter — store parsed value on res.locals.
            res.locals['query'] = r.data;
         } else if (source === 'body') {
            req.body = r.data;
         } else {
            Object.assign(req.params, r.data as Record<string, string>);
         }
         next();
      };
