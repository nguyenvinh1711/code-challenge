import type { ICache } from './interfaces';

interface Entry {
   value: unknown;
   expiresAt: number;
   tags: readonly string[];
}

// Bounded LRU + TTL cache using insertion-ordered Map. Touching an entry
// re-inserts it to mark it most-recently-used; eviction pops the first
// (oldest) key when size exceeds `max`.
export class MemoryCache implements ICache {
   private readonly store = new Map<string, Entry>();
   private readonly tagIndex = new Map<string, Set<string>>();

   constructor(private readonly max: number) {
      if (max <= 0) throw new Error('MemoryCache max must be > 0');
   }

   async get<T>(key: string): Promise<T | undefined> {
      const entry = this.store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
         this.removeKey(key);
         return undefined;
      }
      // LRU touch: move to end.
      this.store.delete(key);
      this.store.set(key, entry);
      return entry.value as T;
   }

   async set<T>(key: string, value: T, ttlMs: number, tags: readonly string[] = []): Promise<void> {
      // Drop prior tag membership before re-inserting.
      const prior = this.store.get(key);
      if (prior) this.detachTags(key, prior.tags);

      this.store.delete(key);
      this.store.set(key, { value, expiresAt: Date.now() + ttlMs, tags });

      for (const tag of tags) {
         let bucket = this.tagIndex.get(tag);
         if (!bucket) {
            bucket = new Set();
            this.tagIndex.set(tag, bucket);
         }
         bucket.add(key);
      }

      // Evict oldest until within capacity.
      while (this.store.size > this.max) {
         const oldest = this.store.keys().next().value;
         if (oldest === undefined) break;
         this.removeKey(oldest);
      }
   }

   async del(key: string): Promise<void> {
      this.removeKey(key);
   }

   async delByTag(tag: string): Promise<void> {
      const bucket = this.tagIndex.get(tag);
      if (!bucket) return;
      for (const key of bucket) {
         const entry = this.store.get(key);
         this.store.delete(key);
         if (entry) this.detachTags(key, entry.tags, tag);
      }
      this.tagIndex.delete(tag);
   }

   async close(): Promise<void> {
      this.store.clear();
      this.tagIndex.clear();
   }

   private removeKey(key: string): void {
      const entry = this.store.get(key);
      if (!entry) return;
      this.store.delete(key);
      this.detachTags(key, entry.tags);
   }

   private detachTags(key: string, tags: readonly string[], skipTag?: string): void {
      for (const tag of tags) {
         if (tag === skipTag) continue;
         const bucket = this.tagIndex.get(tag);
         if (!bucket) continue;
         bucket.delete(key);
         if (bucket.size === 0) this.tagIndex.delete(tag);
      }
   }
}
