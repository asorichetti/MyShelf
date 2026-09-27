import type { Db } from '../types';

export interface Migration {
  /** Strictly increasing, never reused. */
  version: number;
  name: string;
  /**
   * SQL run inside a transaction, or a function given that transaction, for a
   * migration that has to look before it leaps (0006 checks for FTS5). Must
   * not change PRAGMA foreign_keys.
   */
  up: string | ((tx: Db) => Promise<void>);
  /**
   * Runs with foreign keys off (switched before its transaction begins, as
   * SQLite requires), for rebuilding a table others reference: dropping it
   * with foreign keys on would delete every row that points at it. The
   * migration fails, and changes nothing, if a reference is broken at the
   * end (`PRAGMA foreign_key_check`).
   */
  foreignKeysOff?: boolean;
}
