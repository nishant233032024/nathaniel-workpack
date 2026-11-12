import { parseCsv } from './csv';
import { isCurrency, isIsoDate, parseAmountToMinor } from './money';
import type { PaymentRow, Plan, Student } from './types';

export interface ImportIssue {
  sourceRow: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportResult<T> {
  rows: T[];
  issues: ImportIssue[];
}

const REQUIRED_STUDENT_HEADERS = [
  'student_id',
  'name',
  'email',
  'country',
  'course',
  'start_date',
  'plan',
  'currency',
  'course_fee',
];

const REQUIRED_PAYMENT_HEADERS = [
  'payment_id',
  'date',
  'payer_name',
  'payer_email',
  'currency',
  'amount',
  'method',
  'reference',
  'note',
];

function headerIndex(header: string[], name: string): number {
  return header.indexOf(name);
}

function checkHeaders(header: string[], required: string[], file: string): ImportIssue[] {
  return required
    .filter((name) => headerIndex(header, name) === -1)
    .map((name) => ({
      sourceRow: 1,
      field: name,
      message: `${file}: required column "${name}" is missing`,
      severity: 'error' as const,
    }));
}

function parsePlan(raw: string): { plan: Plan; ok: boolean } {
  const value = raw.trim().toLowerCase();
  if (value === 'full') return { plan: 'full', ok: true };
  if (value.startsWith('instalment')) return { plan: 'instalments', ok: true };
  return { plan: 'full', ok: false };
}

export function parseStudentsCsv(text: string): ImportResult<Student> {
  const grid = parseCsv(text);
  if (grid.length === 0) return { rows: [], issues: [{ sourceRow: 0, field: '', message: 'students.csv is empty', severity: 'error' }] };

  const header = grid[0].map((cell) => cell.trim());
  const issues = checkHeaders(header, REQUIRED_STUDENT_HEADERS, 'students.csv');
  const rows: Student[] = [];

  for (let r = 1; r < grid.length; r += 1) {
    const cells = grid[r];
    const sourceRow = r + 1;
    const get = (name: string) => (cells[headerIndex(header, name)] ?? '').trim();

    const studentId = get('student_id');
    if (!studentId) {
      issues.push({ sourceRow, field: 'student_id', message: 'missing student_id', severity: 'error' });
      continue;
    }
    const currencyRaw = get('currency').toUpperCase();
    if (!isCurrency(currencyRaw)) {
      issues.push({ sourceRow, field: 'currency', message: `unsupported currency "${get('currency')}"`, severity: 'error' });
      continue;
    }
    const feeMinor = parseAmountToMinor(get('course_fee').replace(/^-/, ''));
    if (feeMinor === null) {
      issues.push({ sourceRow, field: 'course_fee', message: `cannot parse fee "${get('course_fee')}"`, severity: 'error' });
      continue;
    }
    const startDate = get('start_date');
    if (!isIsoDate(startDate)) {
      issues.push({ sourceRow, field: 'start_date', message: `invalid start date "${startDate}"`, severity: 'error' });
      continue;
    }
    const { plan, ok } = parsePlan(get('plan'));
    if (!ok) {
      issues.push({ sourceRow, field: 'plan', message: `unknown plan "${get('plan')}", treated as full`, severity: 'warning' });
    }

    rows.push({
      studentId,
      name: get('name'),
      email: get('email'),
      country: get('country'),
      course: get('course'),
      startDate,
      plan,
      planRaw: get('plan'),
      currency: currencyRaw,
      courseFeeMinor: feeMinor,
      sourceRow,
    });
  }

  return { rows, issues };
}

export function parsePaymentsCsv(text: string): ImportResult<PaymentRow> {
  const grid = parseCsv(text);
  if (grid.length === 0) return { rows: [], issues: [{ sourceRow: 0, field: '', message: 'payments.csv is empty', severity: 'error' }] };

  const header = grid[0].map((cell) => cell.trim());
  const issues = checkHeaders(header, REQUIRED_PAYMENT_HEADERS, 'payments.csv');
  const rows: PaymentRow[] = [];

  for (let r = 1; r < grid.length; r += 1) {
    const cells = grid[r];
    const sourceRow = r + 1;
    const get = (name: string) => (cells[headerIndex(header, name)] ?? '').trim();

    const paymentId = get('payment_id');
    if (!paymentId) {
      issues.push({ sourceRow, field: 'payment_id', message: 'missing payment_id', severity: 'error' });
      continue;
    }

    const currencyRaw = get('currency').toUpperCase();
    const amountRaw = get('amount');
    const amountMinor = parseAmountToMinor(amountRaw);
    const date = get('date');

    if (!isIsoDate(date)) {
      issues.push({ sourceRow, field: 'date', message: `invalid date "${date}"`, severity: 'error' });
    }
    if (amountMinor === null) {
      issues.push({ sourceRow, field: 'amount', message: `cannot parse amount "${amountRaw}"`, severity: 'error' });
    }
    if (!isCurrency(currencyRaw)) {
      issues.push({ sourceRow, field: 'currency', message: `unsupported currency "${get('currency')}"`, severity: 'error' });
    }

    rows.push({
      paymentId,
      date,
      payerName: get('payer_name'),
      payerEmail: get('payer_email'),
      currencyRaw,
      amountRaw,
      currency: isCurrency(currencyRaw) ? currencyRaw : null,
      amountMinor,
      method: get('method'),
      reference: get('reference'),
      note: get('note'),
      sourceRow,
    });
  }

  return { rows, issues };
}
