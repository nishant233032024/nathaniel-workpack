/**
 * SQLite implementation of `FeesStore`, used for local development.
 *
 * This module imports `node:sqlite` at the top, so it must only be loaded when
 * SQLite is actually the backend — see `index.ts`, which imports it lazily.
 */
import {
  clearResolution,
  listAudit,
  loadPayments,
  loadResolutions,
  loadStudents,
  openDatabase,
  saveResolution,
} from './store';
import type { FeesStore } from './types';

export async function createSqliteStore(): Promise<FeesStore> {
  const db = openDatabase();
  return {
    backend: 'sqlite',
    async loadStudents() {
      return loadStudents(db);
    },
    async loadPayments() {
      return loadPayments(db);
    },
    async loadResolutions() {
      return loadResolutions(db);
    },
    async saveResolution(resolution) {
      saveResolution(db, resolution);
    },
    async clearResolution(paymentId, actor) {
      clearResolution(db, paymentId, actor);
    },
    async listAudit(limit = 25) {
      return listAudit(db, limit);
    },
    async close() {
      db.close();
    },
  };
}
