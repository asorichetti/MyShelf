import type { FieldChange, RefreshField } from './draftDiff';

/**
 * The fields "Fetch missing details" may fill in for imported books (P08-05):
 * what a spreadsheet usually lacks. Title, authors, year and the rest came
 * from the user's own file and are left alone.
 */
export const missingDetailFields: readonly RefreshField[] = ['cover', 'summary', 'genres', 'series', 'pages', 'publisher'];

/**
 * The changes a lookup may offer an imported book: only additions to those
 * fields, never a replacement of anything the file held (the user typed it),
 * and genres only when every genre the book has stays. The rating and notes
 * are never part of a diff. Every change offered is ticked.
 */
export function missingDetailChanges(changes: readonly FieldChange[]): FieldChange[] {
  return changes
    .filter((c) => missingDetailFields.includes(c.field))
    .filter((c) => (c.field === 'genres' ? c.suggested : c.kind === 'add'))
    .map((c) => ({ ...c, suggested: true }));
}
