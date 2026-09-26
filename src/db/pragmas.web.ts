/**
 * Per-connection settings on web (wa-sqlite has no WAL): enforced foreign
 * keys, and a 16 MB page cache instead of SQLite's 2 MB, so a search over a
 * big library (the search index plus the books it finds) stays in memory
 * rather than going back to the browser's storage for every page.
 */
export const CONNECTION_PRAGMAS = 'PRAGMA foreign_keys = ON; PRAGMA cache_size = -16000;';
