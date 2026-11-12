import { addDays, daysBetween } from './money';
import type { Assumptions, Instalment, Student } from './types';

/**
 * Split a fee into equal instalments without losing a single minor unit.
 *
 * The remainder is spread one minor unit at a time over the earliest
 * instalments. For EUR 350.00 over three instalments that is
 * 117.00, 117.00, 116.00 - deterministic, and the total always equals the fee.
 */
export function splitInstalments(feeMinor: number, count: number): number[] {
  if (count <= 0) throw new Error('instalment count must be positive');
  if (!Number.isSafeInteger(feeMinor) || feeMinor < 0) {
    throw new Error(`fee must be a non-negative integer, received ${feeMinor}`);
  }
  const base = Math.floor(feeMinor / count);
  const remainder = feeMinor - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * Build the payment schedule for a student.
 *
 * Business rule: the first instalment is due before the course starts, then one
 * every 30 days. `firstInstalmentOffsetDays` is 0 by default, meaning "due on
 * the start date" (payable before the first lesson); set it to -1 for the
 * stricter reading. Either way the interval is anchored on the start date, not
 * on the previous payment's actual date.
 */
export function buildSchedule(student: Student, assumptions: Assumptions): Instalment[] {
  const count = student.plan === 'instalments' ? 3 : 1;
  const amounts = splitInstalments(student.courseFeeMinor, count);
  const firstDue = addDays(student.startDate, assumptions.firstInstalmentOffsetDays);

  return amounts.map((amountMinor, index) => ({
    index: index + 1,
    dueDate: addDays(firstDue, index * assumptions.instalmentIntervalDays),
    amountMinor,
    paidMinor: 0,
    status: 'due' as const,
  }));
}

/**
 * Apply credit to instalments oldest-first and mark each one's status.
 *
 * FIFO is deliberate: it answers "which instalment is this money for?" the same
 * way every time, and it makes the overdue figure the tail of the schedule
 * rather than an ordering accident.
 */
export function allocateToSchedule(
  instalments: Instalment[],
  creditMinor: number,
  asOf: string,
  assumptions: Assumptions,
): Instalment[] {
  let remaining = creditMinor;
  return instalments.map((instalment) => {
    const applied = Math.max(0, Math.min(remaining, instalment.amountMinor));
    remaining -= applied;
    const paidMinor = applied;
    const settled = paidMinor >= instalment.amountMinor;

    let status: Instalment['status'];
    if (settled) {
      status = 'paid';
    } else if (isOverdue(instalment.dueDate, asOf, assumptions)) {
      status = paidMinor > 0 ? 'partial' : 'overdue';
    } else if (daysBetween(asOf, instalment.dueDate) > 0) {
      status = 'future';
    } else {
      status = 'due';
    }

    return { ...instalment, paidMinor, status };
  });
}

/**
 * A due date is overdue when it is strictly before the as-of date.
 *
 * The default is strict: something due today has not been missed yet. Flip
 * `overdueIncludesDueToday` for a portal that chases on the due date itself.
 */
export function isOverdue(dueDate: string, asOf: string, assumptions: Assumptions): boolean {
  const delta = daysBetween(dueDate, asOf);
  return assumptions.overdueIncludesDueToday ? delta >= 0 : delta > 0;
}

export function overdueMinorOf(instalments: Instalment[]): number {
  return instalments
    .filter((instalment) => instalment.status === 'overdue' || instalment.status === 'partial')
    .reduce((sum, instalment) => sum + (instalment.amountMinor - instalment.paidMinor), 0);
}

export function futureMinorOf(instalments: Instalment[]): number {
  return instalments
    .filter((instalment) => instalment.status === 'future')
    .reduce((sum, instalment) => sum + instalment.amountMinor, 0);
}

/** Days overdue measured from the oldest unsettled overdue instalment. */
export function daysOverdueOf(instalments: Instalment[], asOf: string, assumptions: Assumptions): number {
  const unpaid = instalments.filter(
    (instalment) =>
      instalment.paidMinor < instalment.amountMinor && isOverdue(instalment.dueDate, asOf, assumptions),
  );
  if (unpaid.length === 0) return 0;
  const oldest = unpaid.reduce((a, b) => (a.dueDate <= b.dueDate ? a : b));
  return Math.max(0, daysBetween(oldest.dueDate, asOf));
}
