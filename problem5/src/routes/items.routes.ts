import { Router } from 'express';
import type { IItemsService } from '../services/interfaces';
import {
   createItemSchema,
   updateItemSchema,
   listQuerySchema,
   idParamSchema,
   type CreateItemInput,
   type UpdateItemInput,
   type ListItemsFilter,
} from '../schemas/items.schema';
import { validate } from '../middleware/validate';
import { ApiError } from '../utils/http-errors';

// Express 5 forwards rejected promises from async handlers to the error
// middleware automatically — no asyncHandler wrapper needed.
export function itemsRouter(itemsService: IItemsService): Router {
   const r = Router();

   // Create an item
   r.post('/',
      validate('body', createItemSchema),
      async (req, res) => {
         const item = await itemsService.createItem(req.body as CreateItemInput);
         res.status(201).json(item);
      });

   // List items
   r.get('/',
      validate('query', listQuerySchema),
      async (_req, res) => {
         const query = res.locals.query as ListItemsFilter;
         const { data, total } = await itemsService.listItems(query);
         const totalPages = Math.max(1, Math.ceil(total / query.limit));
         res.json({ data, total, page: query.page, limit: query.limit, totalPages });
      });

   // Get details of an item
   r.get('/:id',
      validate('params', idParamSchema),
      async (req, res) => {
         const id = Number(req.params.id);
         const item = await itemsService.getItem(id);
         if (!item) throw new ApiError(404, 'NotFound', `Item ${id} not found`);
         res.json(item);
      });

   // Update an itemy, use patch when updating partially
   r.put(
      '/:id',
      validate('params', idParamSchema),
      validate('body', updateItemSchema),
      async (req, res) => {
         const id = Number(req.params.id);
         const updated = await itemsService.updateItem(id, req.body);
         if (!updated) throw new ApiError(404, 'NotFound', `Item ${id} not found`);
         res.json({ status: 'success', message: 'Item updated successfully', item: updated });
      }
   );

   // Delete an item
   r.delete('/:id',
      validate('params', idParamSchema),
      async (req, res) => {
         const id = Number(req.params.id);
         const removed = await itemsService.deleteItem(id);
         if (!removed) throw new ApiError(404, 'NotFound', `Item ${id} not found`);
         res.json({ status: 'success', message: `Item ${id} deleted successfully` });
      });

   return r;
}
