/** Per-connection settings on Android/iOS: write-ahead logging and enforced foreign keys. */
export const CONNECTION_PRAGMAS = 'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;';
