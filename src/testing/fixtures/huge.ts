import { generateBooks } from './generated';

import type { Fixture } from './types';

/**
 * 10,000 generated books (the `large` fixture's pattern, five times over,
 * with notes on every seventh book) for measuring search and scrolling (P09-03).
 * Deterministic. Built on first use, so it costs nothing until a test or
 * journey loads it.
 */
let books: Fixture['books'] | undefined;
export const huge: Fixture = {
  get books() {
    books ??= generateBooks(10_000, { notes: true });
    return books;
  },
};
