import { ListItemsFilter } from "../../schemas";

export interface CRUD {
   list: (filter: ListItemsFilter) => Promise<any>;
   create: (resource: any) => Promise<any>;
   updateById: (id: string, resource: any) => Promise<string>;
   getById: (id: string) => Promise<any>;
   deleteById: (id: string) => Promise<string>;
}