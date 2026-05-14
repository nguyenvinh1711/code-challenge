import type { IItemsRepository } from '../interfaces';
import type { Item } from '../../models';
import type { CreateItemInput, UpdateItemInput, ListItemsFilter } from '../../schemas';
import type { ICache } from '../../cache';
import { buildItemKey, buildListKey, TAG_ITEMS_LIST } from '../../cache';
import type { CacheTtls } from './items.repository.class';

type ListResult = { data: Item[]; total: number };
type CachedItem = Item | null;

// Functional counterpart of CachingItemsRepository. Closure holds the
// inflight map; same read-through + single-flight + negative caching +
// tag-based invalidation semantics.
export function createCachingItemsRepository(
   inner: IItemsRepository,
   cache: ICache,
   ttl: CacheTtls,
   keyPrefix: string,
): IItemsRepository {
   const inflight = new Map<string, Promise<unknown>>();

   const singleFlight = <T>(key: string, load: () => Promise<T>): Promise<T> => {
      const existing = inflight.get(key) as Promise<T> | undefined;
      if (existing) return existing;
      const promise = load().finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
   };

   const through = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
      const hit = await cache.get<T>(key);
      if (hit !== undefined) return hit;
      return singleFlight(key, load);
   };

   const invalidateItem = async (id: number): Promise<void> => {
      await Promise.all([
         cache.del(buildItemKey(keyPrefix, id)),
         cache.delByTag(TAG_ITEMS_LIST),
      ]);
   };

   return {
      async create(input: CreateItemInput): Promise<Item> {
         const item = await inner.create(input);
         await cache.delByTag(TAG_ITEMS_LIST);
         await cache.set(buildItemKey(keyPrefix, item.id), item, ttl.itemMs);
         return item;
      },

      async list(filter: ListItemsFilter): Promise<ListResult> {
         const key = buildListKey(keyPrefix, filter);
         return through<ListResult>(key, async () => {
            const result = await inner.list(filter);
            await cache.set(key, result, ttl.listMs, [TAG_ITEMS_LIST]);
            return result;
         });
      },

      async get(id: number): Promise<Item | undefined> {
         const key = buildItemKey(keyPrefix, id);
         const cached = await cache.get<CachedItem>(key);
         if (cached === null) return undefined;
         if (cached !== undefined) return cached;

         return singleFlight(key, async () => {
            const item = await inner.get(id);
            if (item === undefined) {
               await cache.set<CachedItem>(key, null, ttl.negativeMs);
               return undefined;
            }
            await cache.set(key, item, ttl.itemMs);
            return item;
         });
      },

      async update(id: number, patch: UpdateItemInput): Promise<Item | undefined> {
         const updated = await inner.update(id, patch);
         await invalidateItem(id);
         if (updated) {
            await cache.set(buildItemKey(keyPrefix, id), updated, ttl.itemMs);
         }
         return updated;
      },

      async delete(id: number): Promise<boolean> {
         const ok = await inner.delete(id);
         await invalidateItem(id);
         return ok;
      },
   };
}
