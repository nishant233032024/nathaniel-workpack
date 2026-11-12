import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SkillError, runSkill } from '../skills/daily-fees-reminders/lib';
import { reconcile } from '../src/lib/finance/reconcile';
import { DEFAULT_ASSUMPTIONS } from '../src/lib/finance/config';
import { parsePaymentsCsv, parseStudentsCsv } from '../src/lib/finance/import';

const root = resolve(__dirname, '..');
const fixtures = resolve(root, 'skills/daily-fees-reminders/fixtures');

const baseOptions = {
  studentsPath: resolve(fixtures, 'students.csv'),
  paymentsPath: resolve(fixtures, 'payments.csv'),
  asOf: '2026-10-31',
};

describe('the skill runs', () => {
  it('writes the four contracted files', () => {
    const { files } = runSkill(baseOptions);
    expect(Object.keys(files).sort()).toEqual([
      'admin-summary.txt',
      'reminders.csv',
      'review-report.json',
      'run-manifest.json',
    ]);
  });

  it('marks the duplicate row rather than counting it twice', () => {
    const { result } = runSkill(baseOptions);
    expect(result.payments.find((line) => line.row.paymentId === 'P6')?.status).toBe('duplicate');
    const diya = result.students.find((account) => account.student.studentId === 'S2')!;
    expect(diya.creditedMinor).toBe(1_000_000);
    expect(diya.overdueMinor).toBe(500_000);
  });

  it('holds the reminder that an unresolved receipt could change', () => {
    const { files, result } = runSkill(baseOptions);
    const tara = result.reminders.find((reminder) => reminder.studentId === 'S3')!;
    expect(tara.held).toBe(true);

    const rows = files['reminders.csv'].trim().split('\n');
    const taraRow = rows.find((line) => line.startsWith('S3,'))!;
    expect(taraRow).toContain(',held,');
    expect(files['admin-summary.txt']).toContain('HELD — unresolved money could make these wrong (1)');
  });

  it('lists only genuine overdue students as ready', () => {
    const { files } = runSkill(baseOptions);
    const rows = files['reminders.csv'].trim().split('\n').slice(1);
    const ready = rows.filter((line) => line.includes(',ready,'));
    expect(ready.map((line) => line.split(',')[0]).sort()).toEqual(['S2', 'S4']);
    expect(files['admin-summary.txt']).toContain('READY TO SEND (2)');
  });

  it('excludes a payment dated after the as-of date', () => {
    const { result } = runSkill(baseOptions);
    expect(result.payments.find((line) => line.row.paymentId === 'P9')?.status).toBe('future');
  });

  it('writes amounts in the student currency, not converted to rupees', () => {
    const { files } = runSkill(baseOptions);
    const priya = files['reminders.csv'].split('\n').find((line) => line.startsWith('S4,'))!;
    expect(priya).toContain(',USD,375.00,');
    expect(priya).toContain('$375.00');
  });

  it('states that nothing was sent', () => {
    const { files } = runSkill(baseOptions);
    expect(files['admin-summary.txt']).toContain('Nothing was sent. Drafts only.');
    expect(JSON.parse(files['run-manifest.json']).sendsMessages).toBe(false);
  });
});

describe('determinism', () => {
  const financial = (files: Record<string, string>) => ({
    reminders: files['reminders.csv'],
    summary: files['admin-summary.txt'],
    review: files['review-report.json'],
  });

  it('produces byte-identical financial output on a second run', () => {
    const first = financial(runSkill(baseOptions).files);
    const second = financial(runSkill(baseOptions).files);
    expect(second).toEqual(first);
  });

  it('keeps the manifest timestamp out of the financial files', () => {
    const { files } = runSkill(baseOptions);
    const manifest = JSON.parse(files['run-manifest.json']);
    expect(typeof manifest.generatedAt).toBe('string');
    expect(files['reminders.csv']).not.toContain(manifest.generatedAt);
    expect(files['admin-summary.txt']).not.toContain(manifest.generatedAt);
  });

  it('changes the summary when the as-of date changes', () => {
    const september = runSkill({ ...baseOptions, asOf: '2026-09-30' }).files['admin-summary.txt'];
    const october = runSkill({ ...baseOptions, asOf: '2026-10-31' }).files['admin-summary.txt'];
    expect(september).not.toBe(october);
  });

  it('honours the stricter first-due reading without changing the fee', () => {
    const standard = runSkill(baseOptions).result;
    const strict = runSkill({ ...baseOptions, firstInstalmentOffsetDays: -1 }).result;
    expect(strict.totals.totalAgreedFeeInrPaise).toBe(standard.totals.totalAgreedFeeInrPaise);
    const a = standard.students.find((s) => s.student.studentId === 'S1')!;
    const b = strict.students.find((s) => s.student.studentId === 'S1')!;
    expect(b.instalments[0].dueDate).not.toBe(a.instalments[0].dueDate);
  });
});

describe('the skill refuses bad input', () => {
  it('rejects a non-date as-of', () => {
    expect(() => runSkill({ ...baseOptions, asOf: '31-10-2026' })).toThrow(SkillError);
  });

  it('rejects a missing file with a clear code', () => {
    try {
      runSkill({ ...baseOptions, studentsPath: resolve(fixtures, 'nope.csv') });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SkillError);
      expect((error as SkillError).code).toBe('MISSING_INPUT');
    }
  });

  it('rejects an unparseable amount instead of skipping the row', () => {
    const broken = resolve(fixtures, 'payments-broken.csv');
    try {
      runSkill({ ...baseOptions, paymentsPath: broken });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SkillError);
      expect((error as SkillError).code).toBe('INVALID_INPUT');
      expect((error as SkillError).message).toContain('eight thousand');
    }
  });
});

describe('skill and portal share one engine', () => {
  it('agrees with the portal on every rupee', () => {
    const students = parseStudentsCsv(readFileSync(baseOptions.studentsPath, 'utf8'));
    const payments = parsePaymentsCsv(readFileSync(baseOptions.paymentsPath, 'utf8'));
    const direct = reconcile({
      students: students.rows,
      payments: payments.rows,
      assumptions: DEFAULT_ASSUMPTIONS,
    });
    const viaSkill = runSkill(baseOptions).result;
    expect(viaSkill.totals).toEqual(direct.totals);
    expect(viaSkill.inputFingerprint).toBe(direct.inputFingerprint);
  });
});
