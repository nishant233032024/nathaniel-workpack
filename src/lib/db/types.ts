import type { PaymentRow, Resolution, Student } from '../finance/types';

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  paymentId: string | null;
  detail: string;
}

/**
 * The storage contract. Two implementations exist:
 *
 *  - SQLite (node:sqlite) for local development, one file, no server.
 *  - Postgres for Vercel, where the filesystem is ephemeral and read-only.
 *
 * Neither implementation stores a balance: both return source rows and human
 * decisions, and the finance engine derives everything else.
 */
export interface FeesStore {
  readonly backend: 'sqlite' | 'postgres';
  loadStudents(): Promise<Student[]>;
  loadPayments(): Promise<PaymentRow[]>;
  loadResolutions(): Promise<Resolution[]>;
  saveResolution(resolution: Resolution): Promise<void>;
  clearResolution(paymentId: string, actor: string): Promise<void>;
  listAudit(limit?: number): Promise<AuditEntry[]>;
  close(): Promise<void>;
}
