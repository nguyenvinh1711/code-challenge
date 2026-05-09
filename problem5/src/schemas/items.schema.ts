import { z } from 'zod';

export const createItemSchema = z.object({
   name: z.string().min(1).max(200),
});

export const updateItemSchema = z
   .object({
      name: z.string().min(1).max(200).optional(),
   })
   .refine((o) => Object.keys(o).length > 0, { message: 'patch must be non-empty' });

export const listQuerySchema = z.object({
   q: z.string().min(1).max(200).optional(),
   limit: z.coerce.number().int().min(1).max(100).default(20),
   page: z.coerce.number().int().min(1).default(1),
   sortBy: z.enum(['id', 'name', 'createdAt', 'updatedAt']).default('createdAt'),
   order: z.enum(['asc', 'desc']).default('desc'),
});

export const idParamSchema = z.object({
   id: z.coerce.number().int().positive(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsFilter = z.infer<typeof listQuerySchema>;
