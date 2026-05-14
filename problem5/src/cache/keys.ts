import { createHash } from 'node:crypto';
import type { ListItemsFilter } from '../schemas';

export const TAG_ITEMS_LIST = 'items:list';

export function buildItemKey(prefix: string, id: number): string {
   return `${prefix}items:id:${id}`;
}

// Stable hash of the normalized filter so equivalent queries collapse to
// the same key regardless of property order or undefined-vs-missing.
export function buildListKey(prefix: string, filter: ListItemsFilter): string {
   const normalized = {
      q: filter.q ?? '',
      limit: filter.limit,
      page: filter.page,
      sortBy: filter.sortBy,
      order: filter.order,
   };
   const hash = createHash('sha1').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
   return `${prefix}items:list:${hash}`;
}
