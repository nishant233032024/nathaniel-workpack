import type { Candidate, PaymentRow, Student } from './types';

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Lowercase, strip punctuation, collapse whitespace: "Tara P." -> "tara p". */
export function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,'’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function firstToken(value: string): string {
  return normalizeName(value).split(' ')[0] ?? '';
}

/**
 * Find students whose evidence could plausibly own this payment.
 *
 * Strong candidates come only from an exact email match or an exact full-name
 * match. Partial names are returned as weak suggestions so a human can act on
 * them, but a weak candidate is never used to allocate money automatically.
 */
export function findCandidates(row: PaymentRow, students: Student[]): Candidate[] {
  const email = normalizeEmail(row.payerEmail);
  const name = normalizeName(row.payerName);
  const strong: Candidate[] = [];

  for (const student of students) {
    if (email && normalizeEmail(student.email) === email) {
      strong.push({
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        confidence: 'strong',
        evidence: 'payer email matches the student record exactly',
      });
      continue;
    }
    if (name && normalizeName(student.name) === name) {
      strong.push({
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        confidence: 'strong',
        evidence: 'payer name matches the student record exactly',
      });
    }
  }

  if (strong.length > 0) return strong;

  // No exact evidence: offer weak, clearly-labelled suggestions only.
  const token = firstToken(row.payerName);
  if (!token || token.length < 3) return [];
  return students
    .filter((student) => firstToken(student.name) === token)
    .map((student) => ({
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      confidence: 'weak' as const,
      evidence: 'first name only - a hint, not a match',
    }));
}

/**
 * Detect rows that describe the same transaction more than once.
 *
 * The rule is deliberately narrow: same payer, same date, same amount, same
 * currency AND the same non-empty payment reference. Without a reference we
 * refuse to deduplicate, because two genuine payments can share a name, a date
 * and an amount.
 */
export function detectDuplicateRows(payments: PaymentRow[]): Map<string, string> {
  const seen = new Map<string, string>();
  const duplicates = new Map<string, string>();

  for (const row of payments) {
    const reference = row.reference.trim().toUpperCase();
    if (!reference) continue;
    const payerKey = row.payerEmail
      ? normalizeEmail(row.payerEmail)
      : normalizeName(row.payerName);
    if (!payerKey) continue;

    const key = [payerKey, row.date, row.amountRaw.trim(), row.currencyRaw.trim().toUpperCase(), reference].join('|');
    const original = seen.get(key);
    if (original) {
      duplicates.set(row.paymentId, original);
    } else {
      seen.set(key, row.paymentId);
    }
  }

  return duplicates;
}
