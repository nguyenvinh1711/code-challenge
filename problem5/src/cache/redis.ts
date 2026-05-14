import type { ICache } from './interfaces';
import type { RedisLike } from './redis.class';

// Functional counterpart of RedisCache. Closure captures the client and
// tag prefix; same pipeline-based tag invalidation; same degrade-to-miss
// behavior on errors.
export function createRedisCache(client: RedisLike, tagPrefix: string): ICache {
   const tagKey = (tag: string): string => `${tagPrefix}tag:${tag}`;

   const warn = (op: string, err: unknown): void => {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`[cache] redis ${op} failed:`, msg);
   };

   client.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[cache] redis error (degrading to miss):', err.message);
   });

   return {
      async get<T>(key: string): Promise<T | undefined> {
         try {
            const raw = await client.get(key);
            if (raw === null) return undefined;
            return JSON.parse(raw) as T;
         } catch (err) {
            warn('get', err);
            return undefined;
         }
      },

      async set<T>(key: string, value: T, ttlMs: number, tags: readonly string[] = []) {
         try {
            const payload = JSON.stringify(value);
            const pipeline = client.pipeline().set(key, payload, 'PX', ttlMs);
            for (const tag of tags) pipeline.sadd(tagKey(tag), key);
            await pipeline.exec();
         } catch (err) {
            warn('set', err);
         }
      },

      async del(key: string) {
         try {
            await client.del(key);
         } catch (err) {
            warn('del', err);
         }
      },

      async delByTag(tag: string) {
         const tk = tagKey(tag);
         try {
            const members = await client.smembers(tk);
            if (members.length === 0) {
               await client.del(tk);
               return;
            }
            await client.pipeline().del(...members).del(tk).exec();
         } catch (err) {
            warn('delByTag', err);
         }
      },

      async close() {
         try {
            await client.quit();
         } catch {
            /* best-effort */
         }
      },
   };
}
