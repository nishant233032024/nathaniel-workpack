/**
 * Import the two source CSVs into Postgres.
 *
 *   DATABASE_URL=postgres://... npm run db:import:pg
 *   DATABASE_URL=postgres://... npm run db:import:pg -- --reset
 *
 * Idempotent: the SHA-256 of the file pair is unique in `import_batches`, so
 * re-running the command cannot create a second financial effect.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { SCHEMA, openPool } from '../src/lib/db/postgres';
import { parsePaymentsCsv, parseStudentsCsv } from '../src/lib/finance/import';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Nothing was written.');
  process.exit(1);
}

const root = process.cwd();
const studentsText = readFileSync(resolve(root, 'data/source/students.csv'), 'utf8');
const paymentsText = readFileSync(resolve(root, 'data/source/payments.csv'), 'utf8');

const students = parseStudentsCsv(studentsText);
const payments = parsePaymentsCsv(paymentsText);
const errors = [...students.issues, ...payments.issues].filter((issue) => issue.severity === 'error');
if (errors.length > 0) {
  console.error(`${errors.length} import error(s); nothing was written.`);
  errors.slice(0, 5).forEach((issue) => console.error(`  row ${issue.sourceRow} ${issue.field}: ${issue.message}`));
  process.exit(1);
}

const sha256 = createHash('sha256').update(studentsText).update('\n---\n').update(paymentsText).digest('hex');

const pool = openPool(url);

try {
  await pool.query(SCHEMA);

  if (process.argv.includes('--reset')) {
    await pool.query('truncate students, payments, resolutions, import_batches, audit_log restart identity');
    console.log('cleared existing rows (--reset)');
  }

  const existing = await pool.query('select id from import_batches where sha256 = $1', [sha256]);
  if ((existing.rowCount ?? 0) > 0) {
    console.log(`These exact files were already imported (batch ${existing.rows[0].id}). Nothing was written.`);
  } else {
    const client = await pool.connect();
    try {
      await client.query('begin');

      for (const student of students.rows) {
        await client.query(
          `insert into students (student_id, name, email, country, course, start_date, plan, currency, course_fee_minor, source_row, raw_row)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           on conflict (student_id) do update set
             name = excluded.name, email = excluded.email, country = excluded.country, course = excluded.course,
             start_date = excluded.start_date, plan = excluded.plan, currency = excluded.currency,
             course_fee_minor = excluded.course_fee_minor, source_row = excluded.source_row, raw_row = excluded.raw_row`,
          [
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
          ],
        );
      }

      const batch = await client.query(
        'insert into import_batches (sha256, imported_at, actor, student_rows, payment_rows) values ($1,$2,$3,$4,$5) returning id',
        [sha256, new Date().toISOString(), 'cli', students.rows.length, payments.rows.length],
      );
      const batchId = Number(batch.rows[0].id);

      for (const payment of payments.rows) {
        await client.query(
          `insert into payments (payment_id, date, payer_name, payer_email, currency, amount_raw, amount_minor, method, reference, note, source_row, raw_row, import_batch)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           on conflict (payment_id) do update set
             date = excluded.date, payer_name = excluded.payer_name, payer_email = excluded.payer_email,
             currency = excluded.currency, amount_raw = excluded.amount_raw, amount_minor = excluded.amount_minor,
             method = excluded.method, reference = excluded.reference, note = excluded.note,
             source_row = excluded.source_row, raw_row = excluded.raw_row`,
          [
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
          ],
        );
      }

      await client.query(
        'insert into audit_log (at, actor, action, payment_id, detail) values ($1,$2,$3,$4,$5)',
        [new Date().toISOString(), 'cli', 'import', null, JSON.stringify({ batchId, sha256, students: students.rows.length, payments: payments.rows.length })],
      );

      await client.query('commit');
      console.log(`imported ${students.rows.length} students and ${payments.rows.length} payments (batch ${batchId})`);
      console.log(`sha256 ${sha256}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  const counts = await pool.query('select (select count(*) from students) as students, (select count(*) from payments) as payments');
  console.log(`in database: ${counts.rows[0].students} students, ${counts.rows[0].payments} payments`);
} finally {
  await pool.end();
}
