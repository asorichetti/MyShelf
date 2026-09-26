/**
 * @jest-environment node
 */
import { gbFixtures } from '../__fixtures__/googleBooksRoutes';
import { olFixtures } from '../__fixtures__/openLibraryRoutes';
import { makeCandidate } from '../candidate';
import { mapVolume } from '../googleBooksMap';
import { dedupeCandidates, mergeCandidates } from '../merge';
import { mapEdition } from '../openLibraryMap';

const olColour = mapEdition(olFixtures.editions.colourOfMagic, {
  work: olFixtures.works.colourOfMagic,
  authors: ['Terry Pratchett'],
  requestedIsbn13: '9780552166591',
  confidence: 0.95,
});
const gbColour = mapVolume(gbFixtures.colourOfMagic.items[0], 0.85)!;

describe('mergeCandidates (Open Library primary, Google Books secondary)', () => {
  const merged = mergeCandidates(olColour, gbColour);

  // Where both providers disagree, the recorded Open Library edition wins.
  it.each([
    ['title', 'The Colour of Magic'],
    ['publisher', 'Corgi Books'],
    ['publicationYear', 1985],
    ['pageCount', 287],
    ['isbn13', '9780552166591'],
    ['isbn10', '0552166596'],
    ['format', 'paperback'],
    ['language', 'en'],
    ['coverUrl', 'https://covers.openlibrary.org/b/id/14647238-L.jpg'],
    ['workKey', 'OL453657W'],
    ['source', 'openlibrary'],
    ['sourceId', 'OL28477029M'],
    ['confidence', 0.95],
  ] as const)('keeps Open Library %s', (field, value) => {
    expect(merged[field]).toEqual(value);
  });

  it('keeps the Open Library summary when it has one', () => {
    expect(merged.summary).toBe(olColour.summary);
  });

  it('takes the Google Books summary when Open Library has none', () => {
    const noSummary = { ...olColour, summary: null };
    expect(mergeCandidates(noSummary, gbColour).summary).toMatch(/^The Colour of Magic is Terry Pratchett's maiden voyage/);
  });

  it('fills every missing edition fact from Google Books', () => {
    const bare = makeCandidate({ title: 'The Colour of Magic', source: 'openlibrary', sourceId: 'OL28477029M' });
    expect(mergeCandidates(bare, gbColour)).toMatchObject({
      publisher: 'Corgi',
      publicationYear: 2012,
      pageCount: 288,
      authors: ['Terry Pratchett'],
      coverUrl: gbColour.coverUrl,
      source: 'openlibrary',
      sourceId: 'OL28477029M',
    });
  });

  it('unites subjects (Open Library first) and adds Google Books categories', () => {
    expect(merged.subjects.slice(0, olColour.subjects.length)).toEqual(olColour.subjects);
    expect(merged.subjects).toContain('Fiction / Fantasy / Humorous');
    expect(new Set(merged.subjects.map((s) => s.toLowerCase())).size).toBe(merged.subjects.length);
  });

  it('unites series hints from both providers', () => {
    expect(merged.seriesHints).toEqual([
      { name: 'Discworld', position: 1, source: 'openlibrary', raw: 'Discworld, Book 1' },
      { name: null, position: 1, source: 'googlebooks', raw: '1' },
      { name: 'Discworld', position: 1, source: 'googlebooks', raw: '(Discworld Novel 1)' },
    ]);
  });

  it('keeps Open Library authors over Google Books spellings', () => {
    const ol = { ...olColour, authors: ['J.R.R. Tolkien'] };
    const gb = { ...gbColour, authors: ['J. R. R. Tolkien'] };
    expect(mergeCandidates(ol, gb).authors).toEqual(['J.R.R. Tolkien']);
  });

  it('becomes an edition when a work merges with an edition', () => {
    const work = makeCandidate({ kind: 'work', title: 'The Colour of Magic', source: 'openlibrary', sourceId: 'OL453657W', editionCount: 93 });
    expect(mergeCandidates(work, gbColour)).toMatchObject({ kind: 'edition', editionCount: 93, isbn13: '9780552166591' });
  });
});

describe('dedupeCandidates', () => {
  const c = (title: string, author: string, isbn13: string | null, source: 'openlibrary' | 'googlebooks' = 'openlibrary') =>
    makeCandidate({ title, authors: [author], isbn13, source, sourceId: `${source}:${title}:${isbn13}` });

  it('merges the same ISBN from both providers', () => {
    const out = dedupeCandidates([olColour, gbColour]);
    expect(out).toHaveLength(1);
    expect(out[0].sourceId).toBe('OL28477029M');
  });

  it('merges a work with an edition of the same title and author', () => {
    const out = dedupeCandidates([
      c('The Colour of Magic', 'Terry Pratchett', null),
      c('Colour of Magic', 'Pratchett, Terry', '9780061020711', 'googlebooks'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: 'openlibrary', isbn13: '9780061020711' });
  });

  it('keeps two editions with different ISBNs apart', () => {
    const out = dedupeCandidates([
      c('The Colour of Magic', 'Terry Pratchett', '9780061020711'),
      c('The Colour Of Magic', 'Terry Pratchett', '9780552166591', 'googlebooks'),
    ]);
    expect(out.map((x) => x.isbn13)).toEqual(['9780061020711', '9780552166591']);
  });

  it('keeps different books by the same author apart', () => {
    const out = dedupeCandidates([c('Dune', 'Frank Herbert', null), c('Dune Messiah', 'Frank Herbert', null)]);
    expect(out).toHaveLength(2);
  });

  it('merges by ISBN after a title match gave the merged candidate an ISBN', () => {
    const out = dedupeCandidates([
      c('The Colour of Magic', 'Terry Pratchett', null),
      c('The Colour of Magic', 'Terry Pratchett', '9780552166591', 'googlebooks'),
      c('The Colour of Magic (Corgi)', 'T. Pratchett', '9780552166591', 'googlebooks'),
    ]);
    expect(out).toHaveLength(1);
  });

  it('keeps first-appearance order', () => {
    const out = dedupeCandidates([c('B', 'x', null), c('A', 'y', null), c('B', 'x', '9780552166591')]);
    expect(out.map((x) => x.title)).toEqual(['B', 'A']);
  });
});
