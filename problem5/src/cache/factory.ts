import type { CacheConfig, ICache } from './interfaces';
import { MemoryCache } from './memory.class';
import { RedisCache, type RedisLike } from './redis.class';

export function buildCache(cfg: CacheConfig): ICache | null {
   switch (cfg.driver) {
      case 'none':
         return null;
      case 'memory':
         return new MemoryCache(cfg.maxEntries);
      case 'redis': {
         if (!cfg.redisUrl) {
            throw new Error('REDIS_URL is required when CACHE_DRIVER=redis');
         }
         // Lazy require so projects that don't use Redis don't need ioredis installed.
         // eslint-disable-next-line @typescript-eslint/no-var-requires
         // More idiomatic to name this RedisConstructor or RedisClass than `Ctor`
         let RedisClass: new (url: string, opts: Record<string, unknown>) => RedisLike;

         try {
            RedisClass = require('ioredis') as never;
         } catch {
            throw new Error(
               "CACHE_DRIVER=redis requires 'ioredis'. Run: npm install ioredis",
            );
         }
         const client = new RedisClass(cfg.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 1 });
         return new RedisCache(client, cfg.keyPrefix);
      }
   }
}
