import type {
   Item,
} from '../models';
import type {
   CreateItemInput,
   UpdateItemInput,
   ListItemsFilter,
} from '../schemas';

// Port: any storage backend (SQLite, Postgres, in-memory, …) must satisfy
// this interface. Concrete adapters live under src/repositories/<driver>/.
// Methods are async so adapters backed by a network DB (Postgres, Mongo, …)
// fit the same contract without changing callers.
export interface IItemsRepository {
   create(input: CreateItemInput): Promise<Item>;
   list(filter: ListItemsFilter): Promise<{ data: Item[]; total: number }>;
   get(id: number): Promise<Item | undefined>;
   update(id: number, patch: UpdateItemInput): Promise<Item | undefined>;
   delete(id: number): Promise<boolean>;
}

// other repository interfaces can be added here