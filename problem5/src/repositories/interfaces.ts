import type {
   Item,
} from '../models';
import type {
   CreateItemInput,
   UpdateItemInput,
   ListItemsFilter,
} from '../schemas';

// generic repository interface for any resource type T. may be for refactoring in the future.
export interface IRepository<T> {
   create(input: unknown): Promise<T>;
   list(filter: Record<string, unknown>): Promise<{ data: T[]; total: number }>;
   get(id: number): Promise<T | undefined>;
   update(id: number, patch: unknown): Promise<T | undefined>;
   delete(id: number): Promise<boolean>;
}

// Any storage backend (SQLite, Postgres, in-memory, …) must satisfy
// this interface. Concrete adapters live under src/repositories/<driver>/.
// Methods are async so adapters backed by a network DB (Postgres, Mongo, …)
// fit the same contract without changing callers.
export interface IItemsRepository extends IRepository<Item> {
   create(input: CreateItemInput): Promise<Item>;
   list(filter: ListItemsFilter): Promise<{ data: Item[]; total: number }>;
   get(id: number): Promise<Item | undefined>;
   update(id: number, patch: UpdateItemInput): Promise<Item | undefined>;
   delete(id: number): Promise<boolean>;
}

// other repository interfaces can be added here

// The full set of repositories the app needs with underlying connections (sqlite Database, pg.Pool). Each driver implements
// `buildRepositories` returning this bundle. Adding a new repo here forces
// every driver to implement it — the type system is the registration check.
export interface IRepositories {
   items: IItemsRepository;
   // users:  IUsersRepository;   ← add new repos here, TS will fail every driver until wired
   close(): Promise<void>;
}