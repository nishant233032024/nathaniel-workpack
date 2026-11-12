/**
 * Recompute every headline number from the source exports and fail loudly if
 * one of them moves. This is what "the money is right" means operationally.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_ASSUMPTIONS } from '../src/lib/finance/config';
import { parsePaymentsCsv, parseStudentsCsv } from '../src/lib/finance/import';
import { formatMoney } from '../src/lib/finance/money';
import { reconcile } from '../src/lib/finance/reconcile';
import { KEYS } from '../src/lib/music/keys';
import { TUNES } from '../src/lib/music/tunes';
import { buildColumns } from '../src/lib/music/notation';

const root = resolve(__dirname, '..');
const students = parseStudentsCsv(readFileSync(resolve(root, 'data/source/students.csv'), 'utf8'));
const payments = parsePaymentsCsv(readFileSync(resolve(root, 'data/source/payments.csv'), 'utf8'));
const result = reconcile({
  students: students.rows,
  payments: payments.rows,
  assumptions: DEFAULT_ASSUMPTIONS,
});

let failures = 0;
let checks = 0;

function check(label: string, actual: number | string, expected: number | string): void {
  checks += 1;
  const ok = actual === expected;
  if (!ok) failures += 1;
  const shown = typeof actual === 'number' && actual > 1_000 ? `${actual} ` : `${actual}`;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label.padEnd(34)} ${shown}`);
  if (!ok) console.log(`        expected ${expected}`);
}

console.log('\nNATHANIEL WORK PACK — VERIFICATION\n');
console.log('Inputs');
check('students parsed', students.rows.length, 25);
check('payments parsed', payments.rows.length, 40);
check('import errors', students.issues.concat(payments.issues).filter((i) => i.severity === 'error').length, 0);

console.log('\nLedger totals (INR paise)');
check('agreed fees', result.totals.totalAgreedFeeInrPaise, 61_031_500);
check('credited to fees', result.totals.totalCreditedInrPaise, 47_423_600);
check('outstanding balance', result.totals.totalBalanceInrPaise, 13_607_900);
check('overdue', result.totals.totalOverdueInrPaise, 11_114_322);
check('credit on account', result.totals.totalOverpaymentCreditInrPaise, 800_000);
check('future instalments', result.totals.totalFutureInrPaise, 2_493_578);
check('unallocated cash', result.totals.totalUnallocatedCashInrPaise, 0);

console.log('\nOctober receipts (INR paise)');
check('gross', result.receipts.grossInrPaise, 3_153_200);
check('PayPal fees', result.receipts.processorFeesInrPaise, 68_964);
check('net', result.receipts.netInrPaise, 3_084_236);
check('GST included', result.receipts.gstInrPaise, 259_322);
check('GST-applicable gross', result.receipts.gstApplicableGrossInrPaise, 1_700_000);

console.log('\nThe trap cases');
const line = (id: string) => result.payments.find((entry) => entry.row.paymentId === id);
const account = (id: string) => result.students.find((entry) => entry.student.studentId === id);
check('P5036 is a duplicate', line('P5036')?.status ?? 'missing', 'duplicate');
check('Diya credited (paise)', account('S104')?.creditedMinor ?? -1, 1_000_000);
check('Diya overdue (paise)', account('S104')?.overdueMinor ?? -1, 500_000);
check('Aarav credit (paise)', account('S101')?.overpaymentCreditMinor ?? -1, 800_000);
check('P5016 waits for a person', line('P5016')?.status ?? 'missing', 'review');
check('Tara reminder held', account('S110')?.reminderHeld ? 'yes' : 'no', 'yes');
check('P5011 is future-dated', line('P5011')?.status ?? 'missing', 'future');
check('P5037 not applied', line('P5037')?.status ?? 'missing', 'review');
check('open review items', result.review.filter((item) => item.status === 'open').length, 4);
check('reminders ready', result.reminders.filter((r) => !r.held).length, 7);
check('reminders held', result.reminders.filter((r) => r.held).length, 1);

console.log('\nMusic');
check('tunes', TUNES.length, 3);
check('selectable keys', KEYS.length, 12);
// Twinkle never uses degree 7, so demonstrate the spelling on Happy Birthday.
const birthday = buildColumns(TUNES[2], 'G');
const seventh = birthday.filter((column) => column.degreeText === '7');
check('degree 7 of G major', seventh.length > 0 ? seventh[0].noteName : 'none', 'F#');
const flatSeven = birthday.filter((column) => column.degreeText === '7' && column.noteName.includes('b'));
check('no Gb for degree 7 in G', flatSeven.length, 0);
check(
  'no octave digits in note names',
  TUNES.every((tune) => KEYS.every((key) => buildColumns(tune, key.id).every((c) => !/\d/.test(c.noteName))))
    ? 'yes'
    : 'no',
  'yes',
);

console.log('\nHeadline figures');
console.log(`  gross ${formatMoney(result.receipts.grossInrPaise, 'INR')} · ` +
  `PayPal ${formatMoney(result.receipts.processorFeesInrPaise, 'INR')} · ` +
  `net ${formatMoney(result.receipts.netInrPaise, 'INR')} · ` +
  `GST ${formatMoney(result.receipts.gstInrPaise, 'INR')}`);
console.log(`  fingerprint ${result.inputFingerprint}`);

console.log(`\n${checks - failures}/${checks} checks passed\n`);
if (failures > 0) {
  console.error(`${failures} check(s) failed. Do not ship this build.`);
  process.exit(1);
}
