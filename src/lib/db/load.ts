import { DEFAULT_ASSUMPTIONS } from '../finance/config';
import { reconcile } from '../finance/reconcile';
import { getStore } from './index';
import type { AuditEntry } from './types';
import type { ReconcileResult } from '../finance/types';

export interface FeesPageData {
  empty: boolean;
  result: ReconcileResult | null;
  audit: AuditEntry[];
  /** Set when a database is expected but unreachable, so the page can explain. */
  dbError?: string;
  backend?: 'sqlite' | 'postgres';
}

/**
 * Read the stored inputs, then derive everything else.
 *
 * Nothing in the database is a cached balance, so this is also the "refresh"
 * path: a resolution added a second ago is reflected the next time it runs.
 */
export async function loadFees(): Promise<FeesPageData> {
  try {
    const store = await getStore();
    const students = await store.loadStudents();
    if (students.length === 0) {
      return { empty: true, result: null, audit: [], backend: store.backend };
    }

    const result = reconcile({
      students,
      payments: await store.loadPayments(),
      resolutions: await store.loadResolutions(),
      assumptions: DEFAULT_ASSUMPTIONS,
    });
    return {
      empty: false,
      result,
      audit: await store.listAudit(25),
      backend: store.backend,
    };
  } catch {
    // Never render a stack trace or a connection string on a public page.
    return {
      empty: true,
      result: null,
      audit: [],
      dbError: process.env.DATABASE_URL
        ? 'A database is configured but could not be reached.'
        : 'No database is configured on this host.',
    };
  }
}
