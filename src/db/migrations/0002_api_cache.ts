import type { Migration } from './types';

/**
 * Successful provider JSON responses, keyed by URL (P02-09, PLAN §6 "Cache").
 * Pruned on start-up: rows older than 30 days go, then the oldest until the
 * table is under 5 MB. Not part of backups (P08-02).
 */
export const apiCache: Migration = {
  version: 2,
  name: '0002_api_cache',
  up: `
CREATE TABLE api_cache (
  url        TEXT PRIMARY KEY,
  body       TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
CREATE INDEX api_cache_fetched_idx ON api_cache (fetched_at);
`,
};
