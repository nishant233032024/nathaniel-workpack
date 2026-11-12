import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dbPath = resolve(root, process.argv.includes('--db') ? process.argv[process.argv.indexOf('--db') + 1] : 'data/fees.db');

for (const suffix of ['', '-wal', '-shm']) {
  const file = `${dbPath}${suffix}`;
  if (existsSync(file)) {
    rmSync(file);
    console.log(`removed ${file}`);
  }
}
console.log('database reset. Run `npm run db:import` to rebuild it from the CSVs.');
