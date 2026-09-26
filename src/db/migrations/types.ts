export interface Migration {
  /** Strictly increasing, never reused. */
  version: number;
  name: string;
  /** SQL run inside a transaction. Must not change PRAGMA foreign_keys. */
  up: string;
}
