import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase, importFiles } from '../src/lib/db/store';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const root = process.cwd();
const studentsPath = resolve(root, arg('students', 'data/source/students.csv'));
const paymentsPath = resolve(root, arg('payments', 'data/source/payments.csv'));
const dbPath = resolve(root, arg('db', 'data/fees.db'));

const db = openDatabase(dbPath);
const summary = importFiles(db, {
  studentsText: readFileSync(studentsPath, 'utf8'),
  paymentsText: readFileSync(paymentsPath, 'utf8'),
  actor: arg('actor', 'cli'),
});
db.close();

console.log(JSON.stringify(summary, null, 2));

if (summary.skipped) {
  console.log('\nThis exact pair of files was already imported. Nothing was written.');
} else {
  console.log(`\nImported ${summary.students} students and ${summary.payments} payments into ${dbPath}.`);
}

const errors = summary.issues.filter((issue) => issue.severity === 'error');
if (errors.length > 0) {
  console.error(`\n${errors.length} error-level import issues. Fix the source rows before trusting balances.`);
  process.exitCode = 1;
}
