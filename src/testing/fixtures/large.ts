import type { Fixture, FixtureBook } from './types';

const ADJECTIVES = ['Silent', 'Hidden', 'Crimson', 'Last', 'Winter', 'Golden', 'Broken', 'Distant', 'Quiet', 'Lost', 'Paper', 'Velvet', 'Iron', 'Hollow', 'Bright', 'Midnight'];
const NOUNS = ['Garden', 'Library', 'River', 'Lantern', 'Orchard', 'Harbour', 'Archive', 'Compass', 'Meadow', 'Tower', 'Letter', 'Island', 'Clock', 'Map', 'Bridge', 'Shelf'];
const ARTICLES = ['The ', 'A ', '', ''];
const GIVEN = ['Ada', 'Ben', 'Clara', 'Dev', 'Elena', 'Farid', 'Grace', 'Hugo', 'Iris', 'Jonas', 'Kofi', 'Lena', 'Mateo', 'Nora', 'Omar', 'Pia', 'Ravi', 'Sofia', 'Tomas', 'Yuki'];
const FAMILY = ['Abbott', 'Byrne', 'Castellano', 'Dimitrov', 'Eriksen', 'Fairweather', 'Gallagher', 'Hartley', 'Iqbal', 'Jansen'];
const GENRES = ['Fiction', 'Fantasy', 'Science Fiction', 'Mystery', 'Thriller', 'Romance', 'Historical Fiction', 'History', 'Poetry', 'Travel'];
const FORMATS = ['paperback', 'hardcover', 'ebook'] as const;

/** 2,000 generated books (200 authors, 10 genres, 40 series) for performance checks. Deterministic. */
function generate(count: number): FixtureBook[] {
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
    return book;
  });
}

export const large: Fixture = { books: generate(2000) };
