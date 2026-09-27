import { candidateToDraft, validateBookDraft } from '@/domain';
import { createFixtureMetadata } from '@/testing/fixtureMetadata';

import { OL_BOOKS } from '../__fixtures__/openLibraryRoutes';
import { mapVolume } from '../googleBooksMap';
import { mapEdition } from '../openLibraryMap';

import type { BookCandidate } from '../types';

/** What a provider sends is saved as it is, and must open in the book form without an error to fix first. */
describe('a mapped candidate makes a valid book draft', () => {
  const nextYear = new Date().getFullYear() + 1;

  it.each([
    ['a forthcoming edition dated years ahead', { publish_date: String(nextYear + 5) }],
    ['a year before printing', { publish_date: '1420' }],
    ['an ISBN in the pages field', { number_of_pages: 9780552166591 }],
  ])('Open Library: %s', (_name, fields) => {
    const candidate = mapEdition({ key: '/books/OL1M', title: 'A Book', ...fields });
    expect(validateBookDraft(candidateToDraft(candidate)).ok).toBe(true);
  });

  it.each([
    ['a forthcoming edition dated years ahead', { publishedDate: `${nextYear + 5}-01-01` }],
    ['a year of zeros', { publishedDate: '0000' }],
    ['an absurd page count', { pageCount: 5_000_000 }],
  ])('Google Books: %s', (_name, fields) => {
    const candidate = mapVolume({ id: 'v1', volumeInfo: { title: 'A Book', ...fields } })!;
    expect(validateBookDraft(candidateToDraft(candidate)).ok).toBe(true);
  });
});

describe('every recorded answer makes a valid book draft', () => {
  it('for each ISBN lookup and edition list in the fixtures', async () => {
    const { service } = createFixtureMetadata();
    const invalid: string[] = [];
    const check = (c: BookCandidate) => {
      const result = validateBookDraft(candidateToDraft(c));
      if (!result.ok) invalid.push(`${c.source}:${c.sourceId} ${JSON.stringify(result.errors)}`);
    };
    for (const isbn of Object.values(OL_BOOKS)) {
      const { candidates } = await service.lookupIsbn(isbn).catch(() => ({ candidates: [] as BookCandidate[] }));
      candidates.forEach(check);
      for (const c of candidates) if (c.workKey) (await service.editions(c.workKey).catch(() => [])).forEach(check);
    }
    expect(invalid).toEqual([]);
  });
});
