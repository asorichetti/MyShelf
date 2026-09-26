/**
 * @jest-environment node
 */
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createFixtureMetadata } from '@/testing/fixtureMetadata';

import { validateBookDraft } from '../bookDraft';
import { candidateToDraft, type CandidateLike } from '../candidateToDraft';

async function lookup(isbn: string) {
  const { service } = createFixtureMetadata();
  const { candidates } = await service.lookupIsbn(isbn);
  return candidates[0];
}

const base: CandidateLike = {
  kind: 'edition',
  title: 'A Book',
  subtitle: null,
  authors: [],
  publisher: null,
  publicationYear: null,
  pageCount: null,
  isbn13: null,
  isbn10: null,
  edition: null,
  language: null,
  format: null,
  summary: null,
  coverUrl: null,
  subjects: [],
  seriesHints: [],
  workKey: null,
  editionCount: null,
  source: 'openlibrary',
  sourceId: 'OL1M',
  confidence: 1,
};

describe('candidateToDraft', () => {
  it('fills every mapped field from a recorded ISBN lookup (The Colour of Magic)', async () => {
    const candidate = await lookup(OL_BOOKS.colourOfMagic);
    const draft = candidateToDraft(candidate);
    expect(draft).toMatchObject({
      title: 'The Colour of Magic',
      authors: [{ name: 'Terry Pratchett', role: 'author', sortName: null }],
      isbn: '9780552166591',
      publisher: 'Corgi Books',
      year: '1985',
      seriesName: 'Discworld',
      seriesPosition: '1',
      notes: '',
    });
    expect(draft.genres).toContain('Fantasy');
    expect(draft.summary.length).toBeGreaterThan(40);
    expect(draft.summary.length).toBeLessThanOrEqual(600);
    expect(draft.coverUri).toMatch(/^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-L\.jpg$/);
    // The user can save it as it is.
    expect(validateBookDraft(draft).ok).toBe(true);
  });

  it('maps a French edition with its language and no series', async () => {
    const draft = candidateToDraft(await lookup(OL_BOOKS.petitPrince));
    expect(draft.language).toBe('fr');
    expect(draft.year).toBe('2007');
    expect(draft.seriesName).toBe('');
    expect(validateBookDraft(draft).ok).toBe(true);
  });

  it('uses an ISBN-10 when there is no ISBN-13, and a library genre keeps its spelling', () => {
    const draft = candidateToDraft(
      { ...base, isbn10: '0345339703', subjects: ['Fiction / Fantasy / Epic'] },
      { existingGenres: ['fantasy'] },
    );
    expect(draft.isbn).toBe('0345339703');
    expect(draft.genres[0]).toBe('fantasy');
  });

  it('drops invalid ISBNs, unknown languages, zero pages and duplicate authors', () => {
    const draft = candidateToDraft({
      ...base,
      isbn13: '9780000000000',
      language: 'english',
      pageCount: 0,
      authors: ['Terry Pratchett', ' terry pratchett ', 'Neil Gaiman'],
    });
    expect(draft).toMatchObject({ isbn: '', language: '', pages: '' });
    expect(draft.authors.map((a) => a.name)).toEqual(['Terry Pratchett', 'Neil Gaiman']);
  });

  it('reads the series from a title pattern and trims a long summary', () => {
    const draft = candidateToDraft({
      ...base,
      title: 'Leviathan Wakes (The Expanse, #1)',
      summary: `<p>${'A ship finds a derelict and everything changes for the crew. '.repeat(20)}</p><p>More.</p>`,
    });
    expect(draft.seriesName).toBe('The Expanse');
    expect(draft.seriesPosition).toBe('1');
    expect(draft.summary.length).toBeLessThanOrEqual(600);
    expect(draft.summary.endsWith('.')).toBe(true);
  });

  it('leaves the cover empty when the candidate has none', () => {
    expect(candidateToDraft(base).coverUri).toBeNull();
  });
});
