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
}
