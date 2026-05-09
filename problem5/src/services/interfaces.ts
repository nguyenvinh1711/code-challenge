import type {
   Item,
} from '../models';
import type {
   CreateItemInput,
   UpdateItemInput,
   ListItemsFilter,
} from '../schemas';

// Core business logic. This interface is used to define the methods that the items service must implement.
export interface IItemsService {
   createItem(input: CreateItemInput): Promise<Item>;
   listItems(filter: ListItemsFilter): Promise<{ data: Item[]; total: number }>;
   getItem(id: number): Promise<Item | undefined>;
   updateItem(id: number, patch: UpdateItemInput): Promise<Item | undefined>;
   deleteItem(id: number): Promise<boolean>;
}

// other service interfaces can be added here