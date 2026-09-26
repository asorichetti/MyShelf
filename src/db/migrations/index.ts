import { initial } from './001_initial';
import type { Migration } from './types';

export type { Migration } from './types';

/** All migrations in order. Append new ones; never edit a shipped migration. */
export const migrations: readonly Migration[] = [initial];

export const LATEST_VERSION = migrations[migrations.length - 1].version;
