/**
 * Integration tests against the two supplied exports.
 *
 * These pin the numbers I worked out by hand from the CSVs, so a change in the
 * engine that moves a rupee fails the build.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePaymentsCsv, parseStudentsCsv } from '../src/lib/finance/import';
import { reconcile } from '../src/lib/finance/reconcile';
import { DEFAULT_ASSUMPTIONS } from '../src/lib/finance/config';
import type { Resolution } from '../src/lib/finance/types';

const root = resolve(__dirname, '..');
const students = parseStudentsCsv(readFileSync(resolve(root, 'data/source/students.csv'), 'utf8'));
const payments = parsePaymentsCsv(readFileSync(resolve(root, 'data/source/payments.csv'), 'utf8'));

function run(resolutions: Resolution[] = []) {
  return reconcile({
    students: students.rows,
    payments: payments.rows,
    resolutions,
    assumptions: DEFAULT_ASSUMPTIONS,
  });
}

const accountOf = (result: ReturnType<typeof run>, id: string) => {
  const account = result.students.find((a) => a.student.studentId === id);
  if (!account) throw new Error(`missing student ${id}`);
  return account;
};
const lineOf = (result: ReturnType<typeof run>, id: string) => {
  const line = result.payments.find((l) => l.row.paymentId === id);
  if (!line) throw new Error(`missing payment ${id}`);
  return line;
};

describe('the source files', () => {
  it('parse with no import errors', () => {
    expect(students.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(payments.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(students.rows).toHaveLength(25);
    expect(payments.rows).toHaveLength(40);
  });
});

describe('known data problems', () => {
  const result = run();

  it('counts the repeated export row once', () => {
    expect(lineOf(result, 'P5007').status).toBe('credited');
    expect(lineOf(result, 'P5036').status).toBe('duplicate');
    // Diya paid 5000 x 2 = 10000, not 15000. Counting it twice would clear her.
    expect(accountOf(result, 'S104').creditedMinor).toBe(1_000_000);
    expect(accountOf(result, 'S104').overdueMinor).toBe(500_000);
  });

  it('refuses to guess the abbreviated payer', () => {
    const line = lineOf(result, 'P5016');
    expect(line.status).toBe('review');
    expect(line.reasons.map((r) => r.code)).toContain('NO_MATCHING_STUDENT');
    expect(line.candidates).toHaveLength(1);
    expect(line.candidates[0].studentId).toBe('S110');
    expect(line.candidates[0].confidence).toBe('weak');
    // Tara's reminder is held because that receipt could change her balance.
    const tara = accountOf(result, 'S110');
    expect(tara.reminderHeld).toBe(true);
    expect(result.reminders.find((r) => r.studentId === 'S110')?.held).toBe(true);
  });

  it('keeps an overpayment as credit instead of revenue', () => {
    const aarav = accountOf(result, 'S101');
    expect(aarav.student.courseFeeMinor).toBe(2_400_000);
    expect(aarav.creditedMinor).toBe(2_400_000);
    expect(aarav.overpaymentCreditMinor).toBe(800_000);
    expect(aarav.balanceMinor).toBe(0);
    expect(lineOf(result, 'P5038').status).toBe('credited');
  });

  it('holds currency mismatches instead of converting them silently', () => {
    expect(lineOf(result, 'P5039').reasons.map((r) => r.code)).toContain('CURRENCY_MISMATCH');
    expect(lineOf(result, 'P5040').reasons.map((r) => r.code)).toContain('CURRENCY_MISMATCH');
    expect(result.totals.totalUnallocatedCashInrPaise).toBe(0);
  });

  it('never invents a refund before it is approved', () => {
    const line = lineOf(result, 'P5037');
    expect(line.status).toBe('review');
    expect(line.cashInrPaise).toBe(0);
    expect(line.creditMinor).toBe(0);
    expect(accountOf(result, 'S114').creditedMinor).toBe(3_000_000);
  });

  it('excludes a payment dated after the as-of date', () => {
    expect(lineOf(result, 'P5011').status).toBe('future');
    const vikram = accountOf(result, 'S107');
    expect(vikram.creditedMinor).toBe(1_800_000);
    expect(vikram.balanceMinor).toBe(900_000);
    expect(vikram.overdueMinor).toBe(0);
  });

  it('records a genuine short payment as a partial', () => {
    const isha = accountOf(result, 'S108');
    expect(isha.creditedMinor).toBe(1_000_000);
    expect(isha.overdueMinor).toBe(500_000);
    expect(isha.daysOverdue).toBe(42);
  });
});

describe('instalment arithmetic on real fees', () => {
  const result = run();

  it('splits EUR 350 into 116.67 / 116.67 / 116.66 and keeps the rounded 117 payment as credit', () => {
    const anika = accountOf(result, 'S122');
    expect(anika.instalments.map((i) => i.amountMinor)).toEqual([11_667, 11_667, 11_666]);
    expect(anika.instalments.reduce((s, i) => s + i.amountMinor, 0)).toBe(35_000);
    expect(anika.overdueMinor).toBe(11_634);
    expect(anika.daysOverdue).toBe(26);
  });

  it('exposes the 0.67 USD residual on a schedule that does not divide evenly', () => {
    const maya = accountOf(result, 'S116');
    expect(maya.instalments.map((i) => i.amountMinor)).toEqual([6_334, 6_333, 6_333]);
    expect(maya.creditedMinor).toBe(12_600);
    expect(maya.overdueMinor).toBe(67);
  });

  it('does not make anyone overdue whose next instalment is still in the future', () => {
    const dev = accountOf(result, 'S113');
    expect(dev.overdueMinor).toBe(0);
    expect(dev.balanceMinor).toBe(0);
  });
});

describe('October receipts', () => {
  const result = run();

  it('grosses only October-dated cash, before PayPal fees', () => {
    expect(result.receipts.month).toBe('2026-10');
    expect(result.receipts.grossInrPaise).toBe(3_153_200); // Rs 31,532.00
    expect(result.receipts.processorFeesInrPaise).toBe(68_964); // Rs 689.64
    expect(result.receipts.netInrPaise).toBe(3_084_236); // Rs 30,842.36
  });

  it('extracts GST only from Indian INR receipts', () => {
    expect(result.receipts.gstApplicableGrossInrPaise).toBe(1_700_000);
    expect(result.receipts.gstInrPaise).toBe(259_322); // Rs 2,593.22
  });

  it('charges PayPal per receipt, in the payment currency', () => {
    expect(lineOf(result, 'P5027').processorFeeInrPaise).toBe(43_176); // $5.14
    expect(lineOf(result, 'P5023').processorFeeInrPaise).toBe(25_788); // $3.07
    expect(lineOf(result, 'P5010').processorFeeInrPaise).toBe(0);
  });
});

describe('human decisions', () => {
  it('assigns the ambiguous receipt and re-runs the numbers', () => {
    const resolution: Resolution = {
      paymentId: 'P5016',
      action: 'assign',
      studentId: 'S110',
      decidedBy: 'test-admin',
      decidedAt: '2026-10-31T12:00:00Z',
    };
    const result = run([resolution]);
    const tara = accountOf(result, 'S110');
    expect(tara.creditedMinor).toBe(2_500_000);
    expect(tara.overdueMinor).toBe(500_000);
    expect(tara.reminderHeld).toBe(false);
    expect(lineOf(result, 'P5016').status).toBe('credited');
  });

  it('refuses a cross-currency assignment without explicit approval', () => {
    const base: Resolution = {
      paymentId: 'P5039',
      action: 'assign',
      studentId: 'S121',
      decidedBy: 'test-admin',
      decidedAt: '2026-10-31T12:00:00Z',
    };
    expect(run([base]).payments.find((l) => l.row.paymentId === 'P5039')?.status).toBe('review');

    const approved = run([{ ...base, allowCrossCurrency: true }]);
    const ravi = accountOf(approved, 'S121');
    // Rs 5,000 at 91 INR/EUR = EUR 54.95 held on account.
    expect(ravi.overpaymentCreditMinor).toBe(5_495);
    expect(approved.totals.totalUnallocatedCashInrPaise).toBe(0);
  });

  it('treats real cash with no student as unallocated, not as revenue', () => {
    const result = run([
      {
        paymentId: 'P5039',
        action: 'unallocated',
        decidedBy: 'test-admin',
        decidedAt: '2026-10-31T12:00:00Z',
      },
    ]);
    expect(result.totals.totalUnallocatedCashInrPaise).toBe(500_000);
    expect(accountOf(result, 'S121').overpaymentCreditMinor).toBe(0);
  });

  it('applies an approved refund as a separate event that reopens the balance', () => {
    const result = run([
      {
        paymentId: 'P5037',
        action: 'accept_refund',
        decidedBy: 'test-admin',
        decidedAt: '2026-10-31T12:00:00Z',
      },
    ]);
    const nina = accountOf(result, 'S114');
    expect(nina.creditedMinor).toBe(1_500_000);
    expect(nina.balanceMinor).toBe(1_500_000);
    expect(nina.overdueMinor).toBe(1_500_000);
    expect(lineOf(result, 'P5037').cashInrPaise).toBe(-1_500_000);
  });
});

describe('determinism', () => {
  it('produces identical financial output for identical input', () => {
    const a = run();
    const b = run();
    expect(a.inputFingerprint).toBe(b.inputFingerprint);
    expect(JSON.stringify(a.students)).toBe(JSON.stringify(b.students));
    expect(JSON.stringify(a.receipts)).toBe(JSON.stringify(b.receipts));
    expect(JSON.stringify(a.reminders)).toBe(JSON.stringify(b.reminders));
  });

  it('changes the fingerprint when a resolution changes', () => {
    const base = run();
    const withResolution = run([
      {
        paymentId: 'P5016',
        action: 'assign',
        studentId: 'S110',
        decidedBy: 'test-admin',
        decidedAt: '2026-10-31T12:00:00Z',
      },
    ]);
    expect(withResolution.inputFingerprint).not.toBe(base.inputFingerprint);
  });

  it('never lets a resolution change the fee or the schedule', () => {
    const base = run();
    const resolved = run([
      {
        paymentId: 'P5016',
        action: 'assign',
        studentId: 'S110',
        decidedBy: 'test-admin',
        decidedAt: '2026-10-31T12:00:00Z',
      },
    ]);
    for (const account of base.students) {
      const after = resolved.students.find((a) => a.student.studentId === account.student.studentId)!;
      expect(after.student.courseFeeMinor).toBe(account.student.courseFeeMinor);
      expect(after.instalments.map((i) => [i.dueDate, i.amountMinor])).toEqual(
        account.instalments.map((i) => [i.dueDate, i.amountMinor]),
      );
    }
  });
});
