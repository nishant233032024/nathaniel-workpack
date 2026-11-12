import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePaymentsCsv, parseStudentsCsv } from '../src/lib/finance/import';
import { reconcile } from '../src/lib/finance/reconcile';
import { DEFAULT_ASSUMPTIONS } from '../src/lib/finance/config';
import { formatMoney } from '../src/lib/finance/money';

const root = resolve(__dirname, '..');
const students = parseStudentsCsv(readFileSync(resolve(root, 'data/source/students.csv'), 'utf8'));
const payments = parsePaymentsCsv(readFileSync(resolve(root, 'data/source/payments.csv'), 'utf8'));

console.log('import issues:', JSON.stringify([...students.issues, ...payments.issues], null, 2));

const result = reconcile({
  students: students.rows,
  payments: payments.rows,
  assumptions: DEFAULT_ASSUMPTIONS,
});

console.log('\n=== students ===');
for (const a of result.students) {
  console.log(
    [
      a.student.studentId,
      a.student.name.padEnd(16),
      a.student.plan.padEnd(8),
      formatMoney(a.student.courseFeeMinor, a.student.currency).padStart(12),
      ('paid ' + formatMoney(a.creditedMinor, a.student.currency)).padStart(14),
      ('bal ' + formatMoney(a.balanceMinor, a.student.currency)).padStart(14),
      ('over ' + formatMoney(a.overdueMinor, a.student.currency)).padStart(14),
      ('d ' + String(a.daysOverdue)).padStart(4),
      a.status.padEnd(8),
      a.reminderHeld ? 'HELD' : '',
      a.overpaymentCreditMinor > 0 ? 'credit ' + formatMoney(a.overpaymentCreditMinor, a.student.currency) : '',
    ].join(' | '),
  );
}

console.log('\n=== payment lines ===');
for (const l of result.payments) {
  console.log(
    [l.row.paymentId, l.row.date, l.row.payerName.padEnd(15), `${l.row.currencyRaw} ${l.row.amountRaw}`.padStart(12), l.status.padEnd(10), (l.studentId ?? '-').padEnd(5), l.evidence].join(' | '),
  );
}

console.log('\n=== review queue ===');
for (const r of result.review) {
  console.log(`${r.paymentId} row${r.sourceRow} ${r.status} :: ${r.reasons.map((x) => x.code).join(',')} :: ${r.reasons.map((x) => x.message).join(' / ')}`);
  for (const c of r.candidates) console.log(`    candidate ${c.studentId} ${c.name} [${c.confidence}] ${c.evidence}`);
}

console.log('\n=== totals ===');
for (const [k, v] of Object.entries(result.totals)) console.log(k.padEnd(30), formatMoney(v, 'INR'));

console.log('\n=== receipts', result.receipts.month, '===');
console.log('gross      ', formatMoney(result.receipts.grossInrPaise, 'INR'));
console.log('paypal fee ', formatMoney(result.receipts.processorFeesInrPaise, 'INR'));
console.log('net        ', formatMoney(result.receipts.netInrPaise, 'INR'));
console.log('gst        ', formatMoney(result.receipts.gstInrPaise, 'INR'), 'on', formatMoney(result.receipts.gstApplicableGrossInrPaise, 'INR'));
for (const l of result.receipts.lines) console.log('  ', l.row.paymentId, l.row.method, formatMoney(l.cashInrPaise, 'INR'), 'fee', formatMoney(l.processorFeeInrPaise, 'INR'), 'gst', formatMoney(l.gstInrPaise, 'INR'));

console.log('\n=== reminders ===');
for (const r of result.reminders) console.log(`${r.studentId} held=${r.held} :: ${r.message}${r.held ? ' << HOLD: ' + r.holdReasons.join('; ') : ''}`);

console.log('\nfingerprint', result.inputFingerprint);
