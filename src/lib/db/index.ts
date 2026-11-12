import type { FeesStore } from './types';

let cached: Promise<FeesStore> | null = null;

/**
 * Choose a storage backend once per process.
 *
 * `DATABASE_URL` set  -> Postgres (Vercel, or any hosted Postgres).
 * otherwise           -> SQLite file (local development).
 *
 * The imports are dynamic so that a Postgres deployment never loads the
 * `node:sqlite` module, and a local run never needs a database server.
 */
export function getStore(): Promise<FeesStore> {
  cached ??= createStore();
  return cached;
}

async function createStore(): Promise<FeesStore> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { createPostgresStore } = await import('./postgres');
    return createPostgresStore(url);
  }
  const { createSqliteStore } = await import('./sqlite');
  return createSqliteStore();
}

/** Test helper: forget the cached store (used between connection attempts). */
export function resetStoreCache(): void {
  cached = null;
}
