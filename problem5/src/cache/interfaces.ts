export type CacheDriver = 'memory' | 'redis' | 'none';

/**
 * Configuration options for cache behavior.
 *
 * @property driver       The underlying cache driver to use ('memory', 'redis', or 'none').
 * @property redisUrl     (Optional) Redis connection URL. Required if driver is 'redis'.
 * @property itemTtlMs    Time-to-live (in milliseconds) for caching individual items (e.g., single objects by ID).
 * @property listTtlMs    Time-to-live (in milliseconds) for caching lists of items (e.g., paginated or search results).
 * @property negativeTtlMs Time-to-live (in milliseconds) for caching "not found" (negative) lookups.
 * @property maxEntries   Maximum number of entries to keep in the cache; older entries are evicted as needed.
 * @property keyPrefix    String to prepend to all cache keys for scoping or environment segregation.
 */
export interface CacheConfig {
   driver: CacheDriver;
   redisUrl?: string;
   itemTtlMs: number;
   listTtlMs: number;
   negativeTtlMs: number;
   maxEntries: number;
   keyPrefix: string;
}

export interface ICache {
   get<T>(key: string): Promise<T | undefined>;
   set<T>(key: string, value: T, ttlMs: number, tags?: readonly string[]): Promise<void>;
   del(key: string): Promise<void>;
   delByTag(tag: string): Promise<void>;
   close(): Promise<void>;
}

// Sentinel for negative caching. We store this instead of `undefined`
// so a cache hit on a known-missing id is distinguishable from a miss.
export const NEGATIVE = Symbol.for('p5.cache.negative');
export type Cached<T> = T | typeof NEGATIVE;
