/**
 * SQLite persistence using Node's built-in `node:sqlite` (no native build step).
 *
 * The database stores *inputs and decisions*, never computed balances. Balances
 * are derived by the engine on every read, which is what makes a re-import safe:
 * re-running the import cannot compound a financial effect.
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { PaymentRow, Resolution, ResolutionAction, Student } from '../finance/types';
import { parsePaymentsCsv, parseStudentsCsv } from '../finance/import';
import { isCurrency, isIsoDate, parseAmountToMinor } from '../finance/money';

export const DEFAULT_DB_PATH = resolve(process.cwd(), 'data/fees.db');

export interface ImportSummary {
  batchId: number | null;
  skipped: boolean;
  students: number;
  payments: number;
  issues: { sourceRow: number; field: string; message: string; severity: string }[];
  sha256: string;
}

export function openDatabase(path: string = DEFAULT_DB_PATH): DatabaseSync {
  if (path !== ':memory:') {
    const dir = path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
    if (dir) mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  migrate(db);
  return db;
}

export function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      student_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      country TEXT NOT NULL,
      course TEXT NOT NULL,
      start_date TEXT NOT NULL,
      plan TEXT NOT NULL,
      currency TEXT NOT NULL,
      course_fee_minor INTEGER NOT NULL,
      source_row INTEGER NOT NULL,
      raw_row TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      payment_id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      payer_name TEXT NOT NULL,
      payer_email TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount_raw TEXT NOT NULL,
      amount_minor INTEGER,
      method TEXT NOT NULL,
      reference TEXT NOT NULL,
      note TEXT NOT NULL,
      source_row INTEGER NOT NULL,
      raw_row TEXT NOT NULL,
      import_batch INTEGER
    );

    CREATE TABLE IF NOT EXISTS resolutions (
      payment_id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      student_id TEXT,
      allow_cross_currency INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      decided_by TEXT NOT NULL,
      decided_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sha256 TEXT NOT NULL UNIQUE,
      imported_at TEXT NOT NULL,
      actor TEXT NOT NULL,
      student_rows INTEGER NOT NULL,
      payment_rows INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      payment_id TEXT,
      detail TEXT NOT NULL
    );
  `);
}

function audit(db: DatabaseSync, actor: string, action: string, paymentId: string | null, detail: unknown): void {
  db.prepare('INSERT INTO audit_log (at, actor, action, payment_id, detail) VALUES (?, ?, ?, ?, ?)').run(
    new Date().toISOString(),
    actor,
    action,
    paymentId,
    JSON.stringify(detail),
  );
}

/**
 * Import both files. Re-importing the byte-identical file is a no-op: the
 * SHA-256 of the pair is unique in `import_batches`.
 */
export function importFiles(
  db: DatabaseSync,
  input: { studentsText: string; paymentsText: string; actor?: string },
): ImportSummary {
  const actor = input.actor ?? 'cli';
  const sha256 = createHash('sha256')
    .update(input.studentsText)
    .update('\n---\n')
    .update(input.paymentsText)
    .digest('hex');

  const existing = db.prepare('SELECT id FROM import_batches WHERE sha256 = ?').get(sha256) as
    | { id: number }
    | undefined;

  const students = parseStudentsCsv(input.studentsText);
  const payments = parsePaymentsCsv(input.paymentsText);
  const issues = [...students.issues, ...payments.issues].map((issue) => ({
    sourceRow: issue.sourceRow,
    field: issue.field,
    message: issue.message,
    severity: issue.severity,
  }));

  if (existing) {
    return {
      batchId: existing.id,
      skipped: true,
      students: students.rows.length,
      payments: payments.rows.length,
      issues,
      sha256,
    };
  }

  const upsertStudent = db.prepare(`
    INSERT INTO students (student_id, name, email, country, course, start_date, plan, currency, course_fee_minor, source_row, raw_row)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id) DO UPDATE SET
      name = excluded.name, email = excluded.email, country = excluded.country, course = excluded.course,
      start_date = excluded.start_date, plan = excluded.plan, currency = excluded.currency,
      course_fee_minor = excluded.course_fee_minor, source_row = excluded.source_row, raw_row = excluded.raw_row
  `);

  const upsertPayment = db.prepare(`
    INSERT INTO payments (payment_id, date, payer_name, payer_email, currency, amount_raw, amount_minor, method, reference, note, source_row, raw_row, import_batch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(payment_id) DO UPDATE SET
      date = excluded.date, payer_name = excluded.payer_name, payer_email = excluded.payer_email,
      currency = excluded.currency, amount_raw = excluded.amount_raw, amount_minor = excluded.amount_minor,
      method = excluded.method, reference = excluded.reference, note = excluded.note,
      source_row = excluded.source_row, raw_row = excluded.raw_row
  `);

  db.exec('BEGIN');
  try {
    const batch = db
      .prepare(
        'INSERT INTO import_batches (sha256, imported_at, actor, student_rows, payment_rows) VALUES (?, ?, ?, ?, ?)',
      )
      .run(sha256, new Date().toISOString(), actor, students.rows.length, payments.rows.length);
    const batchId = Number(batch.lastInsertRowid);

    for (const student of students.rows) {
      upsertStudent.run(
        student.studentId,
        student.name,
        student.email,
        student.country,
        student.course,
        student.startDate,
        student.planRaw,
        student.currency,
        student.courseFeeMinor,
        student.sourceRow,
        JSON.stringify(student),
      );
    }

    for (const payment of payments.rows) {
      upsertPayment.run(
        payment.paymentId,
        payment.date,
        payment.payerName,
        payment.payerEmail,
        payment.currencyRaw,
        payment.amountRaw,
        payment.amountMinor,
        payment.method,
        payment.reference,
        payment.note,
        payment.sourceRow,
        JSON.stringify(payment),
        batchId,
      );
    }

    db.exec('COMMIT');
    audit(db, actor, 'import', null, {
      batchId,
      sha256,
      students: students.rows.length,
      payments: payments.rows.length,
      issues: issues.length,
    });

    return {
      batchId,
      skipped: false,
      students: students.rows.length,
      payments: payments.rows.length,
      issues,
      sha256,
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function planFromRaw(raw: string): Student['plan'] {
  return raw.trim().toLowerCase().startsWith('instalment') ? 'instalments' : 'full';
}

export function loadStudents(db: DatabaseSync): Student[] {
  const rows = db
    .prepare('SELECT * FROM students ORDER BY student_id')
    .all() as unknown as Record<string, unknown>[];

  return rows.map((row) => ({
    studentId: String(row.student_id),
    name: String(row.name),
    email: String(row.email),
    country: String(row.country),
    course: String(row.course),
    startDate: String(row.start_date),
    plan: planFromRaw(String(row.plan)),
    planRaw: String(row.plan),
    currency: String(row.currency) as Student['currency'],
    courseFeeMinor: Number(row.course_fee_minor),
    sourceRow: Number(row.source_row),
  }));
}

export function loadPayments(db: DatabaseSync): PaymentRow[] {
  const rows = db
    .prepare('SELECT * FROM payments ORDER BY source_row')
    .all() as unknown as Record<string, unknown>[];

  return rows.map((row) => {
    const currencyRaw = String(row.currency);
    const amountRaw = String(row.amount_raw);
    const parsed = parseAmountToMinor(amountRaw);
    return {
      paymentId: String(row.payment_id),
      date: String(row.date),
      payerName: String(row.payer_name),
      payerEmail: String(row.payer_email),
      currencyRaw,
      amountRaw,
      currency: isCurrency(currencyRaw) ? currencyRaw : null,
      amountMinor: parsed,
      method: String(row.method),
      reference: row.reference === null ? '' : String(row.reference),
      note: row.note === null ? '' : String(row.note),
      sourceRow: Number(row.source_row),
    };
  });
}

export function loadResolutions(db: DatabaseSync): Resolution[] {
  const rows = db
    .prepare('SELECT * FROM resolutions ORDER BY payment_id')
    .all() as unknown as Record<string, unknown>[];

  return rows.map((row) => ({
    paymentId: String(row.payment_id),
    action: String(row.action) as ResolutionAction,
    studentId: row.student_id === null ? undefined : String(row.student_id),
    allowCrossCurrency: Number(row.allow_cross_currency) === 1,
    note: row.note === null ? undefined : String(row.note),
    decidedBy: String(row.decided_by),
    decidedAt: String(row.decided_at),
  }));
}

/** Record a human decision. The audit entry is written in the same transaction. */
export function saveResolution(
  db: DatabaseSync,
  resolution: Resolution,
  actor: string = resolution.decidedBy,
): void {
  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO resolutions (payment_id, action, student_id, allow_cross_currency, note, decided_by, decided_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(payment_id) DO UPDATE SET
        action = excluded.action, student_id = excluded.student_id,
        allow_cross_currency = excluded.allow_cross_currency, note = excluded.note,
        decided_by = excluded.decided_by, decided_at = excluded.decided_at
    `).run(
      resolution.paymentId,
      resolution.action,
      resolution.studentId ?? null,
      resolution.allowCrossCurrency ? 1 : 0,
      resolution.note ?? null,
      resolution.decidedBy,
      resolution.decidedAt,
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  audit(db, actor, `resolve:${resolution.action}`, resolution.paymentId, resolution);
}

/** Remove a decision so the automatic verdict applies again. Audited. */
export function clearResolution(db: DatabaseSync, paymentId: string, actor = 'cli'): void {
  db.prepare('DELETE FROM resolutions WHERE payment_id = ?').run(paymentId);
  audit(db, actor, 'resolve:cleared', paymentId, { paymentId });
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  paymentId: string | null;
  detail: string;
}

export function listAudit(db: DatabaseSync, limit = 50): AuditEntry[] {
  const rows = db
    .prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?')
    .all(limit) as unknown as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    at: String(row.at),
    actor: String(row.actor),
    action: String(row.action),
    paymentId: row.payment_id === null ? null : String(row.payment_id),
    detail: String(row.detail),
  }));
}

export function isReady(db: DatabaseSync): boolean {
  const row = db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number } | undefined;
  return (row?.n ?? 0) > 0 && isIsoDate('2026-10-31');
}
