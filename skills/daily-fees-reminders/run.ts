#!/usr/bin/env node
/**
 * Daily fees reminders — command line entrypoint.
 *
 *   npx tsx skills/daily-fees-reminders/run.ts \
 *     --students data/source/students.csv \
 *     --payments data/source/payments.csv \
 *     --as-of 2026-10-31 \
 *     --out skills/daily-fees-reminders/out
 *
 * Exit codes: 0 success, 1 validation or input failure, 2 usage error.
 * The skill never sends anything and never invents a payment.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SkillError, runSkill } from './lib';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

const USAGE = `Usage:
  run.ts --students <students.csv> --payments <payments.csv> --as-of <YYYY-MM-DD> [options]

Required:
  --students <path>     students export
  --payments <path>     payments export
  --as-of <date>        the date to reconcile to, e.g. 2026-10-31

Options:
  --out <dir>           output directory (default skills/daily-fees-reminders/out)
  --resolutions <path>  JSON array of human decisions
  --first-due <mode>    start_date (default) or day_before_start
  --strict-today        treat something due today as already overdue
`;

function fail(message: string, code: number): never {
  console.error(`\n✗ ${message}\n`);
  if (code === 2) console.error(USAGE);
  process.exit(code);
}

const students = arg('students');
const payments = arg('payments');
const asOf = arg('as-of');

if (!students || !payments || !asOf) {
  console.error('Missing required argument.');
  console.error(USAGE);
  process.exit(2);
}

const outDir = resolve(arg('out') ?? 'skills/daily-fees-reminders/out');
const firstDue = arg('first-due') ?? 'start_date';

if (firstDue !== 'start_date' && firstDue !== 'day_before_start') {
  fail(`--first-due must be start_date or day_before_start, received "${firstDue}"`, 2);
}

try {
  const { files } = runSkill({
    studentsPath: students,
    paymentsPath: payments,
    asOf,
    resolutionsPath: arg('resolutions'),
    firstInstalmentOffsetDays: firstDue === 'day_before_start' ? -1 : 0,
    overdueIncludesDueToday: process.argv.includes('--strict-today'),
  });

  mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(resolve(outDir, name), content, 'utf8');
  }

  const summary = files['admin-summary.txt'].split('\n').slice(0, 3).join('\n');
  console.log(summary);
  console.log(`\n✓ wrote ${Object.keys(files).length} files to ${outDir}`);
  console.log('  reminders.csv, admin-summary.txt, review-report.json, run-manifest.json');
  console.log('  nothing was sent.');
} catch (error) {
  if (error instanceof SkillError) {
    console.error(`\n✗ ${error.code}: ${error.message}\n`);
    console.error('No files were written.');
    process.exit(1);
  }
  throw error;
}
