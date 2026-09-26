import type { FixtureBook } from './types';

const ADJECTIVES = ['Silent', 'Hidden', 'Crimson', 'Last', 'Winter', 'Golden', 'Broken', 'Distant', 'Quiet', 'Lost', 'Paper', 'Velvet', 'Iron', 'Hollow', 'Bright', 'Midnight'];
const NOUNS = ['Garden', 'Library', 'River', 'Lantern', 'Orchard', 'Harbour', 'Archive', 'Compass', 'Meadow', 'Tower', 'Letter', 'Island', 'Clock', 'Map', 'Bridge', 'Shelf'];
const ARTICLES = ['The ', 'A ', '', ''];
const GIVEN = ['Ada', 'Ben', 'Clara', 'Dev', 'Elena', 'Farid', 'Grace', 'Hugo', 'Iris', 'Jonas', 'Kofi', 'Lena', 'Mateo', 'Nora', 'Omar', 'Pia', 'Ravi', 'Sofia', 'Tomas', 'Yuki'];
const FAMILY = ['Abbott', 'Byrne', 'Castellano', 'Dimitrov', 'Eriksen', 'Fairweather', 'Gallagher', 'Hartley', 'Iqbal', 'Jansen'];
const GENRES = ['Fiction', 'Fantasy', 'Science Fiction', 'Mystery', 'Thriller', 'Romance', 'Historical Fiction', 'History', 'Poetry', 'Travel'];
const FORMATS = ['paperback', 'hardcover', 'ebook'] as const;
const NOTES = ['Signed by the author', 'Water damage on the back cover', 'Gift from Grandma', 'Bought at the Hay festival', 'First edition'];

export interface GenerateOptions {
  /** Also give every seventh book a note, so full-text search has notes to read. */
  notes?: boolean;
}

/**
 * Deterministic generated books for performance checks: titles such as
 * "The Silent Garden 1", 200 authors, 10 genres and a series for every fifth
 * book. The same count always gives the same books.
 */
export function generateBooks(count: number, { notes = false }: GenerateOptions = {}): FixtureBook[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const book: FixtureBook = {
      title: `${ARTICLES[i % ARTICLES.length]}${ADJECTIVES[i % ADJECTIVES.length]} ${NOUNS[Math.floor(i / ADJECTIVES.length) % NOUNS.length]} ${n}`,
      authors: [`${GIVEN[i % GIVEN.length]} ${FAMILY[Math.floor(i / GIVEN.length) % FAMILY.length]}`],
      genres: [GENRES[i % GENRES.length]],
      publicationYear: 1900 + (i % 125),
      pageCount: 120 + (i % 400),
      format: FORMATS[i % FORMATS.length],
      language: 'en',
    };
    if (i % 5 === 0) book.series = { name: `Saga ${(i / 5) % 40}`, position: Math.floor(i / 200) + 1 };
    if (notes && i % 7 === 0) book.notes = NOTES[(i / 7) % NOTES.length];
    return book;
  });
}
