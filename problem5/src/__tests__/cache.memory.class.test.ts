// just sample test cases for the memory cache (class based)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCache } from '../cache/memory.class';

test('memory cache: set and get', async () => {
   const cache = new MemoryCache(10);
   await cache.set('k', { x: 1 }, 1000);
   assert.deepEqual(await cache.get('k'), { x: 1 });
});

test('memory cache: miss returns undefined', async () => {
   const cache = new MemoryCache(10);
   assert.equal(await cache.get('missing'), undefined);
});

test('memory cache: TTL expiry', async () => {
   const cache = new MemoryCache(10);
   await cache.set('k', 'v', 20);
   await new Promise((r) => setTimeout(r, 40));
   assert.equal(await cache.get('k'), undefined);
});

test('memory cache: LRU eviction', async () => {
   const cache = new MemoryCache(2);
   await cache.set('a', 1, 1000);
   await cache.set('b', 2, 1000);
   await cache.get('a'); // touch a → b is now oldest
   await cache.set('c', 3, 1000); // evicts b
   assert.equal(await cache.get('a'), 1);
   assert.equal(await cache.get('b'), undefined);
   assert.equal(await cache.get('c'), 3);
});

test('memory cache: tag invalidation drops all tagged keys', async () => {
   const cache = new MemoryCache(10);
   await cache.set('list:1', 'a', 1000, ['items:list']);
   await cache.set('list:2', 'b', 1000, ['items:list']);
   await cache.set('item:1', 'untouched', 1000, ['items:id']);

   await cache.delByTag('items:list');

   assert.equal(await cache.get('list:1'), undefined);
   assert.equal(await cache.get('list:2'), undefined);
   assert.equal(await cache.get('item:1'), 'untouched');
});

test('memory cache: del removes single key and its tag membership', async () => {
   const cache = new MemoryCache(10);
   await cache.set('list:1', 'a', 1000, ['items:list']);
   await cache.set('list:2', 'b', 1000, ['items:list']);
   await cache.del('list:1');
   await cache.delByTag('items:list');
   assert.equal(await cache.get('list:2'), undefined);
});

test('memory cache: storing null is a hit, not a miss', async () => {
   const cache = new MemoryCache(10);
   await cache.set('k', null, 1000);
   assert.equal(await cache.get('k'), null);
});
