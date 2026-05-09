import path from 'node:path';
import { newSqliteDb } from '../repositories/sqlite/db';
import { newSqliteItemsRepository } from '../repositories/sqlite/items.repository';

const ADJECTIVES = [
   'Quick', 'Lazy', 'Bright', 'Silent', 'Bold', 'Brave', 'Calm', 'Eager',
   'Fierce', 'Gentle', 'Happy', 'Jolly', 'Kind', 'Lucky', 'Mighty', 'Noble',
   'Proud', 'Rapid', 'Shiny', 'Tiny', 'Witty', 'Zesty', 'Crimson', 'Golden',
];

const NOUNS = [
   'Falcon', 'Tiger', 'Panda', 'Otter', 'Hawk', 'Wolf', 'Rabbit', 'Eagle',
   'Dolphin', 'Lion', 'Fox', 'Bear', 'Mountain', 'River', 'Forest', 'Star',
   'Comet', 'Meadow', 'Canyon', 'Harbor', 'Lantern', 'Compass', 'Arrow', 'Anchor',
];

const SUFFIXES = [
   'Project', 'Task', 'Notebook', 'Sprint', 'Goal', 'Idea', 'Plan', 'Quest',
   'Mission', 'Draft', 'Blueprint', 'Sketch', 'Prototype', 'Workshop',
];

function pick<T>(arr: T[]): T {
   return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomName(): string {
   return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${pick(SUFFIXES)} #${Math.floor(Math.random() * 10_000)}`;
}

async function main() {
   const count = Number(process.argv[2] ?? 20);
   if (!Number.isInteger(count) || count < 1) {
      console.error(`Invalid count: ${process.argv[2]}. Provide a positive integer.`);
      process.exit(1);
   }

   const dbPath = process.env.DB_PATH?.trim()
      ? path.resolve(process.cwd(), process.env.DB_PATH)
      : undefined;

   const db = newSqliteDb(dbPath);
   const repo = newSqliteItemsRepository(db);

   console.log(`Seeding ${count} item(s)...`);
   const created: number[] = [];
   for (let i = 0; i < count; i++) {
      const item = await repo.create({ name: randomName() });
      created.push(item.id);
   }

   console.log(`Done. Inserted ${created.length} items.`);
   console.log(`ID range: ${created[0]} → ${created[created.length - 1]}`);

   db.close();
}

main().catch((err) => {
   console.error('Seed failed:', err);
   process.exit(1);
});
