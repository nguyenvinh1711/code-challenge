import path from 'node:path';
import { loadConfig, buildRepositories } from '../config';

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

function parseArgs(argv: string[]): { count: number; clear: boolean } {
   const args = argv.slice(2);
   const clear = args.includes('--clear');
   const positional = args.filter((a) => !a.startsWith('--'));
   const raw = positional[0] ?? '20';
   const count = Number(raw);
   if (!Number.isInteger(count) || count < 1) {
      throw new Error(`Invalid count: ${raw}. Provide a positive integer.`);
   }
   return { count, clear };
}

async function main() {
   try {
      process.loadEnvFile(path.join(__dirname, '..', '..', '.env'));
   } catch {
      /* .env optional */
   }

   if (process.env['NODE_ENV'] === 'production') {
      throw new Error('Refusing to seed in NODE_ENV=production');
   }

   const { count, clear } = parseArgs(process.argv);
   const config = loadConfig();
   const repos = buildRepositories(config);
   try {
      if (clear) {
         console.log('Clearing existing items…');
         // Walk pages and delete via the port — works on any driver.
         // Acceptable for seed-sized datasets; not for prod tables.
         while (true) {
            const { data } = await repos.items.list({
               limit: 100,
               page: 1,
               sortBy: 'id',
               order: 'asc',
            });
            if (data.length === 0) break;
            for (const it of data) {
               await repos.items.delete(it.id);
            }
            console.log(`Done. Deleted ${data.length} items.\n`);
         }
      }

      console.log(`Seeding ${count} item(s) into driver=${config.driver}…`);
      const ids: number[] = [];
      for (let i = 0; i < count; i++) {
         const item = await repos.items.create({ name: randomName() });
         ids.push(item.id);
      }
      console.log(`Done. Inserted ${ids.length} item(s).`);
      if (ids.length) {
         console.log(`ID range: ${ids[0]} → ${ids[ids.length - 1]}\n`);
      }
   } finally {
      await repos.close();
   }
}

main().catch((e) => {
   console.error('Seed failed:', e);
   process.exit(1);
});
