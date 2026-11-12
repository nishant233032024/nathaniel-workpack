import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatMoney,
  gstIncludedInGross,
  parseAmountToMinor,
  paypalFeeMinor,
  toInrPaise,
} from '../src/lib/finance/money';
import { allocateToSchedule, buildSchedule, daysOverdueOf, splitInstalments } from '../src/lib/finance/schedule';
import { DEFAULT_ASSUMPTIONS } from '../src/lib/finance/config';
import { detectDuplicateRows, findCandidates } from '../src/lib/finance/matching';
import type { PaymentRow, Student } from '../src/lib/finance/types';

const row = (over: Partial<PaymentRow>): PaymentRow => ({
  paymentId: 'P1',
  date: '2026-10-01',
  payerName: 'A B',
  payerEmail: 'a@b.com',
  currencyRaw: 'INR',
  amountRaw: '100',
  currency: 'INR',
  amountMinor: 10000,
  method: 'UPI',
  reference: 'R1',
  note: '',
  sourceRow: 2,
  ...over,
});

describe('money parsing', () => {
  it('parses whole and decimal amounts into minor units', () => {
    expect(parseAmountToMinor('24000')).toBe(2_400_000);
    expect(parseAmountToMinor('110.50')).toBe(11_050);
    expect(parseAmountToMinor('-15000')).toBe(-1_500_000);
    expect(parseAmountToMinor('1,234')).toBe(123_400);
    expect(parseAmountToMinor('abc')).toBeNull();
    expect(parseAmountToMinor('10.555')).toBeNull();
    expect(parseAmountToMinor('')).toBeNull();
  });

  it('formats exactly, without floating point drift', () => {
    expect(formatMoney(2_400_000, 'INR')).toBe('₹24,000.00');
    expect(formatMoney(-1_500_000, 'INR')).toBe('-₹15,000.00');
    expect(formatMoney(5, 'USD')).toBe('$0.05');
  });

  it('converts to INR paise using the fixed rates', () => {
    // $110.00 = 11000 cents -> 924000 paise = Rs 9,240.00
    expect(toInrPaise(11_000, 'USD', DEFAULT_ASSUMPTIONS)).toBe(924_000);
    expect(toInrPaise(17_500, 'EUR', DEFAULT_ASSUMPTIONS)).toBe(1_592_500);
    expect(toInrPaise(900_000, 'INR', DEFAULT_ASSUMPTIONS)).toBe(900_000);
  });
});

describe('PayPal fees', () => {
  it('charges 4.4% plus 0.30 in the payment currency', () => {
    // $110.00 -> 4.84 + 0.30 = 5.14
    expect(paypalFeeMinor(11_000, DEFAULT_ASSUMPTIONS)).toBe(514);
    // $63.00 -> 2.772 rounds to 2.77, + 0.30 = 3.07
    expect(paypalFeeMinor(6_300, DEFAULT_ASSUMPTIONS)).toBe(307);
    // Rs 1000 -> 44 + 0.30 = 44.30
    expect(paypalFeeMinor(100_000, DEFAULT_ASSUMPTIONS)).toBe(4_430);
  });

  it('never charges a fee larger than a tiny payment', () => {
    expect(paypalFeeMinor(10, DEFAULT_ASSUMPTIONS)).toBe(30);
  });
});

describe('GST', () => {
  it('extracts 18/118 of a GST-inclusive receipt', () => {
    expect(gstIncludedInGross(900_000, 18)).toBe(137_288);
    expect(gstIncludedInGross(800_000, 18)).toBe(122_034);
    expect(gstIncludedInGross(900_000, 18) + gstIncludedInGross(800_000, 18)).toBe(259_322);
  });

  it('is unaffected by the payment method', () => {
    const gross = 900_000;
    expect(gstIncludedInGross(gross, 18)).toBe(gstIncludedInGross(gross, 18));
  });
});

describe('instalment splitting', () => {
  it('splits evenly when it can', () => {
    expect(splitInstalments(2_400_000, 3)).toEqual([800_000, 800_000, 800_000]);
  });

  it('gives the remainder to the earliest instalments and never loses a unit', () => {
    const parts = splitInstalments(35_000, 3);
    expect(parts).toEqual([11_667, 11_667, 11_666]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(35_000);

    const usd = splitInstalments(19_000, 3);
    expect(usd).toEqual([6_334, 6_333, 6_333]);
    expect(usd.reduce((a, b) => a + b, 0)).toBe(19_000);
  });

  it('handles fees smaller than the instalment count', () => {
    const parts = splitInstalments(2, 3);
    expect(parts).toEqual([1, 1, 0]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(2);
  });
});

describe('schedule', () => {
  const student: Student = {
    studentId: 'S1',
    name: 'Test Student',
    email: 't@example.com',
    country: 'India',
    course: 'Piano',
    startDate: '2026-09-05',
    plan: 'instalments',
    planRaw: 'instalments (3)',
    currency: 'INR',
    courseFeeMinor: 30_000_00,
    sourceRow: 2,
  };

  it('anchors three instalments on the start date, 30 days apart', () => {
    const schedule = buildSchedule(student, DEFAULT_ASSUMPTIONS);
    expect(schedule.map((i) => i.dueDate)).toEqual(['2026-09-05', '2026-10-05', '2026-11-04']);
  });

  it('treats a full-plan student as one obligation', () => {
    const schedule = buildSchedule({ ...student, plan: 'full' }, DEFAULT_ASSUMPTIONS);
    expect(schedule).toHaveLength(1);
    expect(schedule[0].amountMinor).toBe(3_000_000);
  });

  it('does not call something overdue on its due date, but does the next day', () => {
    const s = buildSchedule(student, DEFAULT_ASSUMPTIONS);
    const onDue = allocateToSchedule(s, 0, '2026-09-05', DEFAULT_ASSUMPTIONS);
    expect(onDue[0].status).toBe('due');
    const nextDay = allocateToSchedule(s, 0, '2026-09-06', DEFAULT_ASSUMPTIONS);
    expect(nextDay[0].status).toBe('overdue');
    expect(daysOverdueOf(nextDay, '2026-09-06', DEFAULT_ASSUMPTIONS)).toBe(1);
  });

  it('allocates payments oldest-first', () => {
    const s = buildSchedule(student, DEFAULT_ASSUMPTIONS);
    const partial = allocateToSchedule(s, 500_000, '2026-09-06', DEFAULT_ASSUMPTIONS);
    expect(partial[0].status).toBe('partial');
    expect(partial[0].paidMinor).toBe(500_000);
    expect(partial[1].status).toBe('future');
  });

  it('measures days overdue from the oldest unsettled instalment', () => {
    const s = buildSchedule(student, DEFAULT_ASSUMPTIONS);
    const allocated = allocateToSchedule(s, 500_000, '2026-10-31', DEFAULT_ASSUMPTIONS);
    expect(daysOverdueOf(allocated, '2026-10-31', DEFAULT_ASSUMPTIONS)).toBe(56);
  });
});

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-10-05', '2026-10-31')).toBe(26);
  });
});

describe('duplicate detection', () => {
  it('flags an identical reference, date and amount, keeping the first row', () => {
    const dupes = detectDuplicateRows([
      row({ paymentId: 'P1' }),
      row({ paymentId: 'P2', sourceRow: 3 }),
      row({ paymentId: 'P3', reference: 'R2' }),
    ]);
    expect([...dupes.entries()]).toEqual([['P2', 'P1']]);
  });

  it('refuses to deduplicate rows with no reference', () => {
    const dupes = detectDuplicateRows([
      row({ paymentId: 'P1', reference: '' }),
      row({ paymentId: 'P2', reference: '', sourceRow: 3 }),
    ]);
    expect(dupes.size).toBe(0);
  });

  it('does not conflate two different amounts on the same day', () => {
    const dupes = detectDuplicateRows([
      row({ paymentId: 'P1' }),
      row({ paymentId: 'P2', amountMinor: 99_00, amountRaw: '99', sourceRow: 3 }),
    ]);
    expect(dupes.size).toBe(0);
  });
});

describe('candidate matching', () => {
  const students: Student[] = [
    {
      studentId: 'S110',
      name: 'Tara Pillai',
      email: 'tara.pillai@example.com',
      country: 'India',
      course: 'Guitar',
      startDate: '2026-08-08',
      plan: 'instalments',
      planRaw: 'instalments (3)',
      currency: 'INR',
      courseFeeMinor: 3_000_000,
      sourceRow: 11,
    },
  ];

  it('matches on exact email', () => {
    const candidates = findCandidates(row({ payerEmail: 'TARA.PILLAI@example.com', payerName: 'T Pillai' }), students);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBe('strong');
  });

  it('offers a partial name only as a weak hint', () => {
    const candidates = findCandidates(
      row({ payerName: 'Tara P.', payerEmail: 'tarap.music@example.com' }),
      students,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBe('weak');
  });

  it('finds nothing when neither name nor email is close', () => {
    expect(findCandidates(row({ payerName: 'Zzz Q', payerEmail: 'q@q.com' }), students)).toEqual([]);
  });
});
