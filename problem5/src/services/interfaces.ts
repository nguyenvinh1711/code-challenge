import type {
   Item,
} from '../models';
import type {
   CreateItemInput,
   UpdateItemInput,
   ListItemsFilter,
} from '../schemas';

// This is generic interface for CRUD services. May be for refactoring in the future.
export interface ICRUDService {
   create: (resource: any) => Promise<any>;
   list: (limit: number, page: number) => Promise<any>;
   getById: (id: string) => Promise<any>; // id is string because it can be any type of id (UUID, integer, etc.)
   updateById: (id: string, resource: any) => Promise<string>;
   deleteById: (id: string) => Promise<string>;
}

// Core business logic. This interface is for the items service.
export interface IItemsService {
   createItem(input: CreateItemInput): Promise<Item>;
   listItems(filter: ListItemsFilter): Promise<{ data: Item[]; total: number }>;
   getItem(id: number): Promise<Item | undefined>;
   updateItem(id: number, patch: UpdateItemInput): Promise<Item | undefined>;
   deleteItem(id: number): Promise<boolean>;
}

// other service interfaces can be added here