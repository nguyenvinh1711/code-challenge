import type { IItemsRepository } from '../repositories/interfaces';
import type { IItemsService } from './interfaces';

// For this exam, I'll make it simple here so just call the repository methods.
export function newItemsService(itemRepo: IItemsRepository): IItemsService {
   return {
      createItem: async (i) => await itemRepo.create(i),
      listItems: async (f) => await itemRepo.list(f),
      getItem: async (id) => await itemRepo.get(id),
      updateItem: async (id, p) => await itemRepo.update(id, p),
      deleteItem: async (id) => await itemRepo.delete(id),
   };
}
