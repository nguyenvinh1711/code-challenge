import type { IItemsRepository } from '../interfaces';
import type { Item } from '../../models';
import type { CreateItemInput, UpdateItemInput, ListItemsFilter } from '../../schemas';
import type { ICache } from '../../cache';
import { buildItemKey, buildListKey, TAG_ITEMS_LIST } from '../../cache';

export interface CacheTtls {
   itemMs: number;
   listMs: number;
   negativeMs: number;
}

type ListResult = { data: Item[]; total: number };

// `null` is stored to represent a known-missing item (negative cache).
type CachedItem = Item | null;

// Decorator: read-through cache with tag-based invalidation and in-process
// single-flight (concurrent misses for the same key collapse to one DB call).
export class CachingItemsRepository implements IItemsRepository {
   private readonly inflight = new Map<string, Promise<unknown>>();

   constructor(
      private readonly inner: IItemsRepository,
      private readonly cache: ICache,
      private readonly ttl: CacheTtls,
      private readonly keyPrefix: string,
   ) {}

   async create(input: CreateItemInput): Promise<Item> {
      const item = await this.inner.create(input);
      // New row could appear in any cached list page, so drop the whole tag.
      await this.cache.delByTag(TAG_ITEMS_LIST);
      // Pre-warm the by-id cache for the freshly created row.
      await this.cache.set(buildItemKey(this.keyPrefix, item.id), item, this.ttl.itemMs);
      return item;
   }

   async list(filter: ListItemsFilter): Promise<ListResult> {
      const key = buildListKey(this.keyPrefix, filter);
      return this.through<ListResult>(key, async () => {
         const result = await this.inner.list(filter);
         await this.cache.set(key, result, this.ttl.listMs, [TAG_ITEMS_LIST]);
         return result;
      });
   }

   async get(id: number): Promise<Item | undefined> {
      const key = buildItemKey(this.keyPrefix, id);
      const cached = await this.cache.get<CachedItem>(key);
      if (cached === null) return undefined; // negative hit
      if (cached !== undefined) return cached;

      return this.singleFlight(key, async () => {
         const item = await this.inner.get(id);
         if (item === undefined) {
            await this.cache.set<CachedItem>(key, null, this.ttl.negativeMs);
            return undefined;
         }
         await this.cache.set(key, item, this.ttl.itemMs);
         return item;
      });
   }

   async update(id: number, patch: UpdateItemInput): Promise<Item | undefined> {
      const updated = await this.inner.update(id, patch);
      await this.invalidateItem(id);
      if (updated) {
         // Pre-warm with the new state to avoid an immediate refetch.
         await this.cache.set(buildItemKey(this.keyPrefix, id), updated, this.ttl.itemMs);
      }
      return updated;
   }

   async delete(id: number): Promise<boolean> {
      const ok = await this.inner.delete(id);
      await this.invalidateItem(id);
      return ok;
   }

   private async invalidateItem(id: number): Promise<void> {
      await Promise.all([
         this.cache.del(buildItemKey(this.keyPrefix, id)),
         this.cache.delByTag(TAG_ITEMS_LIST),
      ]);
   }

   // Read-through with single-flight: same key, concurrent misses share work.
   private async through<T>(key: string, load: () => Promise<T>): Promise<T> {
      const hit = await this.cache.get<T>(key);
      if (hit !== undefined) return hit;
      return this.singleFlight(key, load);
   }

   private async singleFlight<T>(key: string, load: () => Promise<T>): Promise<T> {
      const existing = this.inflight.get(key) as Promise<T> | undefined;
      if (existing) return existing;
      const promise = load().finally(() => this.inflight.delete(key));
      this.inflight.set(key, promise);
      return promise;
   }
}
