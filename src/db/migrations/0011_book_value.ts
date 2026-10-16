import type { Migration } from './types';

/**
 * A book's purchase or estimated value (P??): a real number in the user's
 * preferred currency, null when unknown. Used to calculate the total
 * collection value shown in Settings. Lookups never set it; only the user
 * can fill or change it in the book form.
 */
export const bookValue: Migration = {
  version: 11,
  name: '0011_book_value',
  up: `
ALTER TABLE books ADD COLUMN value REAL NULL;
`,
};
