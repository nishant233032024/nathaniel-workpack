/**
 * Postgres implementation of `FeesStore`, used on Vercel.
 *
 * Same tables and same semantics as the SQLite schema. Amounts are stored as
 * integer minor units in `bigint` columns, and every value read back is coerced
 * to a number explicitly, because `pg` returns bigint as a string.
 */
import { Pool, type PoolClient } from 'pg';
import { isCurrency, parseAmountToMinor } from '../finance/money';
import type { PaymentRow, Resolution, ResolutionAction, Student } from '../finance/types';
import type { AuditEntry, FeesStore } from './types';

export const SCHEMA = `
  create table if not exists students (
    student_id text primary key,
    name text not null,
    email text not null,
    country text not null,
    course text not null,
    start_date text not null,
    plan text not null,
    currency text not null,
    course_fee_minor bigint not null,
    source_row integer not null,
    raw_row text not null
  );

  create table if not exists payments (
    payment_id text primary key,
    date text not null,
    payer_name text not null,
    payer_email text not null,
    currency text not null,
    amount_raw text not null,
    amount_minor bigint,
    method text not null,
    reference text not null,
    note text not null,
    source_row integer not null,
    raw_row text not null,
    import_batch integer
  );

  create table if not exists resolutions (
    payment_id text primary key,
    action text not null,
    student_id text,
    allow_cross_currency integer not null default 0,
    note text,
    decided_by text not null,
    decided_at text not null
  );

  create table if not exists import_batches (
    id bigserial primary key,
    sha256 text not null unique,
    imported_at text not null,
    actor text not null,
    student_rows integer not null,
    payment_rows integer not null
  );

  create table if not exists audit_log (
    id bigserial primary key,
    at text not null,
    actor text not null,
    action text not null,
    payment_id text,
    detail text not null
  );
`;

/** A Pool per process, reused across requests in the same serverless instance. */
const globalForPg = globalThis as unknown as { __feesPgPool?: Pool };

function sslFor(connectionString: string): { rejectUnauthorized: false } | undefined {
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return undefined;
  return { rejectUnauthorized: false };
}

/** A pool for CLI scripts, which manage their own lifecycle. */
export function openPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: sslFor(connectionString),
  });
}

export async function createPostgresStore(connectionString: string): Promise<FeesStore> {
  const pool = globalForPg.__feesPgPool ?? openPool(connectionString);
  globalForPg.__feesPgPool = pool;

  await pool.query(SCHEMA);

  const planFromRaw = (raw: string): Student['plan'] =>
    raw.trim().toLowerCase().startsWith('instalment') ? 'instalments' : 'full';

  return {
    backend: 'postgres',

    async loadStudents() {
      const { rows } = await pool.query('select * from students order by student_id');
      return rows.map(
        (row): Student => ({
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
        }),
      );
    },

    async loadPayments() {
      const { rows } = await pool.query('select * from payments order by source_row');
      return rows.map((row): PaymentRow => {
        const currencyRaw = String(row.currency);
        const amountRaw = String(row.amount_raw);
        return {
          paymentId: String(row.payment_id),
          date: String(row.date),
          payerName: String(row.payer_name),
          payerEmail: String(row.payer_email),
          currencyRaw,
          amountRaw,
          currency: isCurrency(currencyRaw) ? currencyRaw : null,
          amountMinor:
            row.amount_minor === null || row.amount_minor === undefined
              ? parseAmountToMinor(amountRaw)
              : Number(row.amount_minor),
          method: String(row.method),
          reference: row.reference === null ? '' : String(row.reference),
          note: row.note === null ? '' : String(row.note),
          sourceRow: Number(row.source_row),
        };
      });
    },

    async loadResolutions() {
      const { rows } = await pool.query('select * from resolutions order by payment_id');
      return rows.map(
        (row): Resolution => ({
          paymentId: String(row.payment_id),
          action: String(row.action) as ResolutionAction,
          studentId: row.student_id === null ? undefined : String(row.student_id),
          allowCrossCurrency: Number(row.allow_cross_currency) === 1,
          note: row.note === null ? undefined : String(row.note),
          decidedBy: String(row.decided_by),
          decidedAt: String(row.decided_at),
        }),
      );
    },

    async saveResolution(resolution) {
      const client: PoolClient = await pool.connect();
      try {
        await client.query('begin');
        await client.query(
          `insert into resolutions (payment_id, action, student_id, allow_cross_currency, note, decided_by, decided_at)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (payment_id) do update set
             action = excluded.action,
             student_id = excluded.student_id,
             allow_cross_currency = excluded.allow_cross_currency,
             note = excluded.note,
             decided_by = excluded.decided_by,
             decided_at = excluded.decided_at`,
          [
            resolution.paymentId,
            resolution.action,
            resolution.studentId ?? null,
            resolution.allowCrossCurrency ? 1 : 0,
            resolution.note ?? null,
            resolution.decidedBy,
            resolution.decidedAt,
          ],
        );
        await client.query(
          'insert into audit_log (at, actor, action, payment_id, detail) values ($1, $2, $3, $4, $5)',
          [new Date().toISOString(), resolution.decidedBy, `resolve:${resolution.action}`, resolution.paymentId, JSON.stringify(resolution)],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },

    async clearResolution(paymentId, actor) {
      await pool.query('delete from resolutions where payment_id = $1', [paymentId]);
      await pool.query(
        'insert into audit_log (at, actor, action, payment_id, detail) values ($1, $2, $3, $4, $5)',
        [new Date().toISOString(), actor, 'resolve:cleared', paymentId, JSON.stringify({ paymentId })],
      );
    },

    async listAudit(limit = 25) {
      const { rows } = await pool.query('select * from audit_log order by id desc limit $1', [limit]);
      return rows.map(
        (row): AuditEntry => ({
          id: Number(row.id),
          at: String(row.at),
          actor: String(row.actor),
          action: String(row.action),
          paymentId: row.payment_id === null ? null : String(row.payment_id),
          detail: String(row.detail),
        }),
      );
    },

    async close() {
      // In a serverless runtime the pool is intentionally kept open per instance.
    },
  };
}
