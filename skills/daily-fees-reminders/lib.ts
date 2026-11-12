/**
 * The daily reminder skill's engine.
 *
 * It deliberately shares `src/lib/finance` with the portal: two finance engines
 * would eventually disagree, and a disagreement about money is a bug.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_ASSUMPTIONS } from '../../src/lib/finance/config';
import { parsePaymentsCsv, parseStudentsCsv, type ImportIssue } from '../../src/lib/finance/import';
import { formatMoney, isIsoDate, minorToDecimalString } from '../../src/lib/finance/money';
import { reconcile } from '../../src/lib/finance/reconcile';
import type { Assumptions, Resolution, ReconcileResult } from '../../src/lib/finance/types';

export const SKILL_VERSION = '1.0.0';

export class SkillError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SkillError';
    this.code = code;
  }
}

export interface SkillOptions {
  studentsPath: string;
  paymentsPath: string;
  asOf: string;
  resolutionsPath?: string;
  firstInstalmentOffsetDays?: number;
  overdueIncludesDueToday?: boolean;
}

export interface SkillOutput {
  files: Record<string, string>;
  result: ReconcileResult;
}

function readText(path: string, label: string): string {
  try {
    return readFileSync(resolve(path), 'utf8');
  } catch {
    throw new SkillError('MISSING_INPUT', `${label} not found at ${path}`);
  }
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function assertNoErrors(issues: ImportIssue[], label: string): void {
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length === 0) return;
  const detail = errors
    .slice(0, 5)
    .map((issue) => `row ${issue.sourceRow} ${issue.field}: ${issue.message}`)
    .join('; ');
  throw new SkillError('INVALID_INPUT', `${label} has ${errors.length} error(s): ${detail}`);
}

function csvCell(value: string | number): string {
  const text = String(value);
  // Guard against spreadsheet formula injection from a payer-supplied name.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function loadResolutions(path: string | undefined): { resolutions: Resolution[]; sha: string | null } {
  if (!path) return { resolutions: [], sha: null };
  const text = readText(path, 'resolutions file');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SkillError('INVALID_INPUT', `resolutions file at ${path} is not valid JSON`);
  }
  if (!Array.isArray(parsed)) {
    throw new SkillError('INVALID_INPUT', 'resolutions file must contain a JSON array');
  }
  const allowed = ['assign', 'duplicate', 'unallocated', 'accept_refund', 'hold'];
  const resolutions = parsed.map((entry, index) => {
    const item = entry as Record<string, unknown>;
    if (typeof item.paymentId !== 'string' || !allowed.includes(String(item.action))) {
      throw new SkillError('INVALID_INPUT', `resolution ${index} needs a paymentId and one of: ${allowed.join(', ')}`);
    }
    return {
      paymentId: item.paymentId,
      action: item.action as Resolution['action'],
      studentId: typeof item.studentId === 'string' ? item.studentId : undefined,
      allowCrossCurrency: item.allowCrossCurrency === true,
      note: typeof item.note === 'string' ? item.note : undefined,
      decidedBy: typeof item.decidedBy === 'string' ? item.decidedBy : 'unknown',
      decidedAt: typeof item.decidedAt === 'string' ? item.decidedAt : '1970-01-01T00:00:00Z',
    };
  });
  return { resolutions, sha: sha256(text) };
}

/**
 * Build every output in memory. Nothing is written until all of it succeeded,
 * so a failed run never leaves a half-updated reminder list on disk.
 */
export function runSkill(options: SkillOptions): SkillOutput {
  if (!isIsoDate(options.asOf)) {
    throw new SkillError('INVALID_AS_OF', `--as-of must be an ISO date (YYYY-MM-DD), received "${options.asOf}"`);
  }

  const studentsText = readText(options.studentsPath, 'students file');
  const paymentsText = readText(options.paymentsPath, 'payments file');
  const students = parseStudentsCsv(studentsText);
  const payments = parsePaymentsCsv(paymentsText);
  assertNoErrors(students.issues, 'students file');
  assertNoErrors(payments.issues, 'payments file');

  if (students.rows.length === 0) throw new SkillError('EMPTY_INPUT', 'students file has no data rows');
  if (payments.rows.length === 0) throw new SkillError('EMPTY_INPUT', 'payments file has no data rows');

  const { resolutions, sha: resolutionsSha } = loadResolutions(options.resolutionsPath);

  const assumptions: Assumptions = {
    ...DEFAULT_ASSUMPTIONS,
    asOf: options.asOf,
    firstInstalmentOffsetDays: options.firstInstalmentOffsetDays ?? DEFAULT_ASSUMPTIONS.firstInstalmentOffsetDays,
    overdueIncludesDueToday: options.overdueIncludesDueToday ?? DEFAULT_ASSUMPTIONS.overdueIncludesDueToday,
  };

  const result = reconcile({
    students: students.rows,
    payments: payments.rows,
    resolutions,
    assumptions,
  });

  // --- reminders.csv ------------------------------------------------------
  const reminderHeader = ['student_id', 'name', 'currency', 'overdue_amount', 'days_overdue', 'status', 'phone', 'message'];
  const reminderRows = result.reminders.map((reminder) => [
    reminder.studentId,
    reminder.studentName,
    reminder.currency,
    minorToDecimalString(reminder.overdueMinor),
    reminder.daysOverdue,
    reminder.held ? 'held' : 'ready',
    reminder.phone ?? '',
    reminder.message,
  ]);
  const remindersCsv = [reminderHeader, ...reminderRows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';

  // --- admin-summary.txt --------------------------------------------------
  const ready = result.reminders.filter((reminder) => !reminder.held);
  const held = result.reminders.filter((reminder) => reminder.held);
  const openReview = result.review.filter((item) => item.status === 'open');

  const lines: string[] = [];
  lines.push('NATHANIEL SCHOOL OF MUSIC — DAILY FEES SUMMARY');
  lines.push(`As of ${result.asOf} (${assumptions.timeZone}), drafted for WhatsApp`);
  lines.push('');
  lines.push(
    `${result.students.length} students · ${result.reminders.length} overdue · ${ready.length} ready · ${held.length} held · ${openReview.length} need a person`,
  );
  lines.push('');
  lines.push('MONEY (INR, fixed exercise rates)');
  lines.push(`  Agreed fees      ${formatMoney(result.totals.totalAgreedFeeInrPaise, 'INR')}`);
  lines.push(`  Credited         ${formatMoney(result.totals.totalCreditedInrPaise, 'INR')}`);
  lines.push(`  Outstanding      ${formatMoney(result.totals.totalBalanceInrPaise, 'INR')}`);
  lines.push(`  Overdue          ${formatMoney(result.totals.totalOverdueInrPaise, 'INR')}`);
  lines.push(`  Held on account  ${formatMoney(result.totals.totalOverpaymentCreditInrPaise, 'INR')}`);
  lines.push(`  Unallocated cash ${formatMoney(result.totals.totalUnallocatedCashInrPaise, 'INR')}`);
  lines.push('');
  lines.push(`RECEIPTS ${result.receipts.month}`);
  lines.push(`  Gross            ${formatMoney(result.receipts.grossInrPaise, 'INR')}`);
  lines.push(`  PayPal fees      ${formatMoney(result.receipts.processorFeesInrPaise, 'INR')}`);
  lines.push(`  Net              ${formatMoney(result.receipts.netInrPaise, 'INR')}`);
  lines.push(`  GST included     ${formatMoney(result.receipts.gstInrPaise, 'INR')}`);
  lines.push('');
  lines.push(`READY TO SEND (${ready.length})`);
  ready.forEach((reminder, index) => {
    lines.push(
      `  ${index + 1}. ${reminder.studentId} ${reminder.studentName} — ${formatMoney(reminder.overdueMinor, reminder.currency)} — ${reminder.daysOverdue} days`,
    );
  });
  if (ready.length === 0) lines.push('  none');
  lines.push('');
  lines.push(`HELD — unresolved money could make these wrong (${held.length})`);
  held.forEach((reminder) => {
    lines.push(`  - ${reminder.studentId} ${reminder.studentName} — ${formatMoney(reminder.overdueMinor, reminder.currency)}`);
    reminder.holdReasons.forEach((reasonText) => lines.push(`      ${reasonText}`));
  });
  if (held.length === 0) lines.push('  none');
  lines.push('');
  lines.push(`NEEDS A PERSON (${openReview.length})`);
  openReview.forEach((item) => {
    lines.push(`  - ${item.paymentId} row ${item.sourceRow}: ${item.reasons.map((r) => r.message).join(' / ')}`);
  });
  if (openReview.length === 0) lines.push('  none');
  lines.push('');
  lines.push(`INPUT FINGERPRINT ${result.inputFingerprint}`);
  lines.push('Nothing was sent. Drafts only.');
  const adminSummary = lines.join('\n') + '\n';

  // --- review-report.json -------------------------------------------------
  const reviewReport = JSON.stringify(
    {
      asOf: result.asOf,
      fingerprint: result.inputFingerprint,
      counts: {
        students: result.students.length,
        payments: result.payments.length,
        open: openReview.length,
        autoResolved: result.review.length - openReview.length,
        remindersReady: ready.length,
        remindersHeld: held.length,
      },
      totals: result.totals,
      receipts: { ...result.receipts, lines: undefined },
      review: result.review,
    },
    null,
    2,
  ) + '\n';

  // --- run-manifest.json --------------------------------------------------
  const outputs: Record<string, string> = {
    'reminders.csv': remindersCsv,
    'admin-summary.txt': adminSummary,
    'review-report.json': reviewReport,
  };

  const manifest = JSON.stringify(
    {
      skill: 'daily-fees-reminders',
      version: SKILL_VERSION,
      asOf: result.asOf,
      // Operational metadata only. Financial output never depends on this.
      generatedAt: new Date().toISOString(),
      engine: { reconcile: 'src/lib/finance/reconcile.ts', inputFingerprint: result.inputFingerprint },
      inputs: {
        students: { path: options.studentsPath, sha256: sha256(studentsText), rows: students.rows.length },
        payments: { path: options.paymentsPath, sha256: sha256(paymentsText), rows: payments.rows.length },
        resolutions: options.resolutionsPath
          ? { path: options.resolutionsPath, sha256: resolutionsSha, rows: resolutions.length }
          : null,
      },
      options: {
        firstInstalmentOffsetDays: assumptions.firstInstalmentOffsetDays,
        overdueIncludesDueToday: assumptions.overdueIncludesDueToday,
        timeZone: assumptions.timeZone,
      },
      counts: {
        reminders: result.reminders.length,
        ready: ready.length,
        held: held.length,
        reviewOpen: openReview.length,
      },
      outputs: Object.fromEntries(
        Object.entries(outputs).map(([name, content]) => [
          name,
          { bytes: Buffer.byteLength(content), sha256: sha256(content) },
        ]),
      ),
      sendsMessages: false,
    },
    null,
    2,
  ) + '\n';

  return {
    files: { ...outputs, 'run-manifest.json': manifest },
    result,
  };
}
