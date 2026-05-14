import type { ICache } from './interfaces';

interface Entry {
   value: unknown;
   expiresAt: number;
   tags: readonly string[];
}

// Functional counterpart of MemoryCache. Same algorithm (insertion-ordered
// Map for LRU, side tag index, TTL on read), implemented with closures
// instead of a class. Drop-in: returns an object that satisfies ICache.
export function createMemoryCache(max: number): ICache {
   if (max <= 0) throw new Error('createMemoryCache max must be > 0');

   const store = new Map<string, Entry>();
   const tagIndex = new Map<string, Set<string>>();

   const detachTags = (key: string, tags: readonly string[], skipTag?: string): void => {
      for (const tag of tags) {
         if (tag === skipTag) continue;
         const bucket = tagIndex.get(tag);
         if (!bucket) continue;
         bucket.delete(key);
         if (bucket.size === 0) tagIndex.delete(tag);
      }
   };

   const removeKey = (key: string): void => {
      const entry = store.get(key);
      if (!entry) return;
      store.delete(key);
      detachTags(key, entry.tags);
   };

   return {
      async get<T>(key: string): Promise<T | undefined> {
         const entry = store.get(key);
         if (!entry) return undefined;
         if (entry.expiresAt <= Date.now()) {
            removeKey(key);
            return undefined;
         }
         store.delete(key);
         store.set(key, entry);
         return entry.value as T;
      },

      async set<T>(key: string, value: T, ttlMs: number, tags: readonly string[] = []) {
         const prior = store.get(key);
         if (prior) detachTags(key, prior.tags);

         store.delete(key);
         store.set(key, { value, expiresAt: Date.now() + ttlMs, tags });

         for (const tag of tags) {
            let bucket = tagIndex.get(tag);
            if (!bucket) {
               bucket = new Set();
               tagIndex.set(tag, bucket);
            }
            bucket.add(key);
         }

         while (store.size > max) {
            const oldest = store.keys().next().value;
            if (oldest === undefined) break;
            removeKey(oldest);
         }
      },

      async del(key: string) {
         removeKey(key);
      },

      async delByTag(tag: string) {
         const bucket = tagIndex.get(tag);
         if (!bucket) return;
         for (const key of bucket) {
            const entry = store.get(key);
            store.delete(key);
            if (entry) detachTags(key, entry.tags, tag);
         }
         tagIndex.delete(tag);
      },

      async close() {
         store.clear();
         tagIndex.clear();
      },
   };
}
