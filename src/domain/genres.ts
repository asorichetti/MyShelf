/**
 * The curated genres metadata lookups map onto (P02-07). They are the same
 * names as the genre editor's starter list (P01-09, `starterGenres`), so a
 * looked-up genre is one the user already sees suggested.
 */
export const curatedGenres = [
  'Fiction',
  'Fantasy',
  'Science Fiction',
  'Mystery',
  'Thriller',
  'Romance',
  'Historical Fiction',
  'Horror',
  'Literary Fiction',
  'Young Adult',
  "Children's",
  'Graphic Novel',
  'Poetry',
  'Biography',
  'Memoir',
  'History',
  'Science',
  'Philosophy',
  'Self-Help',
  'Cookery',
  'Travel',
  'Art',
  'Religion',
  'Business',
  'Reference',
] as const;

export type CuratedGenre = (typeof curatedGenres)[number];

/** Non-fiction genres: weakened when a book's subjects say it is fiction ("History" on a Regency novel). */
export const nonFictionGenres: ReadonlySet<CuratedGenre> = new Set<CuratedGenre>([
  'Biography',
  'Memoir',
  'History',
  'Science',
  'Philosophy',
  'Self-Help',
  'Cookery',
  'Travel',
  'Art',
  'Religion',
  'Business',
  'Reference',
]);
