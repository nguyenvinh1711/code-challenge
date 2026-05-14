import type { ICache } from './interfaces';

// Minimal duck-typed surface so we don't require ioredis at compile time.
// ioredis is loaded lazily inside the factory only when CACHE_DRIVER=redis.
export interface RedisLike {
   get(key: string): Promise<string | null>;
   set(key: string, value: string, mode: 'PX', ttlMs: number): Promise<unknown>;
   del(...keys: string[]): Promise<unknown>;
   sadd(key: string, member: string): Promise<unknown>;
   smembers(key: string): Promise<string[]>;
   pipeline(): RedisPipeline;
   quit(): Promise<unknown>;
   on(event: 'error', handler: (err: Error) => void): unknown;
}

interface RedisPipeline {
   set(key: string, value: string, mode: 'PX', ttlMs: number): RedisPipeline;
   sadd(key: string, member: string): RedisPipeline;
   del(...keys: string[]): RedisPipeline;
   exec(): Promise<unknown>;
}

// Redis cache with tag-based invalidation via auxiliary SETs.
// Errors are logged and degraded to misses — cache is never load-bearing.
export class RedisCache implements ICache {
   constructor(
      private readonly client: RedisLike,
      private readonly tagPrefix: string,
   ) {
      client.on('error', (err) => {
         // eslint-disable-next-line no-console
         console.warn('[cache] redis error (degrading to miss):', err.message);
      });
   }

   async get<T>(key: string): Promise<T | undefined> {
      try {
         const raw = await this.client.get(key);
         if (raw === null) return undefined;
         return JSON.parse(raw) as T;
      } catch (err) {
         this.warn('get', err);
         return undefined;
      }
   }

   async set<T>(key: string, value: T, ttlMs: number, tags: readonly string[] = []): Promise<void> {
      try {
         const payload = JSON.stringify(value);
         const pipeline = this.client.pipeline().set(key, payload, 'PX', ttlMs);
         for (const tag of tags) {
            pipeline.sadd(this.tagKey(tag), key);
         }
         await pipeline.exec();
      } catch (err) {
         this.warn('set', err);
      }
   }

   async del(key: string): Promise<void> {
      try {
         await this.client.del(key);
      } catch (err) {
         this.warn('del', err);
      }
   }

   async delByTag(tag: string): Promise<void> {
      const tagKey = this.tagKey(tag);
      try {
         const members = await this.client.smembers(tagKey);
         if (members.length === 0) {
            await this.client.del(tagKey);
            return;
         }
         await this.client.pipeline().del(...members).del(tagKey).exec();
      } catch (err) {
         this.warn('delByTag', err);
      }
   }

   async close(): Promise<void> {
      try {
         await this.client.quit();
      } catch {
         /* best-effort */
      }
   }

   private tagKey(tag: string): string {
      return `${this.tagPrefix}tag:${tag}`;
   }

   private warn(op: string, err: unknown): void {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`[cache] redis ${op} failed:`, msg);
   }
}
