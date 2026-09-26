import { init } from './0001_init';
import { apiCache } from './0002_api_cache';
import { pendingLookups } from './0003_pending_lookups';
import { coverAttempts } from './0004_cover_attempts';
import { backupSnapshots } from './0005_backup_snapshots';
import { bookSearch } from './0006_book_search';
import { bookRating } from './0007_book_rating';

import type { Migration } from './types';

export type { Migration } from './types';

/** All migrations in order. Append new ones; never edit a shipped migration. */
export const migrations: readonly Migration[] = [init, apiCache, pendingLookups, coverAttempts, backupSnapshots, bookSearch, bookRating];

export const LATEST_VERSION = migrations[migrations.length - 1].version;
