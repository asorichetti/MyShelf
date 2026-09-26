import type { Migration } from './types';

/**
 * The reader's own rating of a book (P10-01): whole stars from 1 to 5, NULL
 * for "not rated". It is the user's opinion, so lookups and "Refresh
 * details" never write it. The search index (0006) is left alone: its
 * triggers fire only for the columns it indexes, and a rating is not text
 * anyone searches for.
 *
 * The CHECK also refuses fractions: INTEGER affinity stores 4.0 as 4, but
 * 4.5 would stay a REAL and pass a plain BETWEEN.
 */
export const bookRating: Migration = {
  version: 7,
  name: '0007_book_rating',
  up: `
ALTER TABLE books ADD COLUMN rating INTEGER NULL CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5 AND typeof(rating) = 'integer'));
CREATE INDEX books_rating_idx ON books (rating);
`,
};
