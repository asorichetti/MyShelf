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

describe('very long titles and names', () => {
  // Measured (September 2026): the longest title in a live Open Library sample of 2,500 was 498 characters, the
  // longest corporate author 154; the recorded fixtures stop at 101 and 25. Anything past 1000 is broken data.
  const crusoe =
    "The Life and Strange Surprizing Adventures of Robinson Crusoe, of York, Mariner: Who lived Eight and Twenty Years, all alone in an un-inhabited Island on the Coast of America, near the Mouth of the Great River of Oroonoque; Having been cast on Shore by Shipwreck, wherein all the Men perished but himself. With An Account how he was at last as strangely deliver'd by Pyrates. Written by Himself.";
  const committee = 'Great Britain. Parliament. House of Commons. Expenditure Committee. Social Services and Employment Sub-Committee'.repeat(3);

  it('are kept whole when a real catalogue could hold them', () => {
    expect(crusoe.length).toBeGreaterThan(300);
    expect(committee.length).toBeGreaterThan(200);
    const ol = mapEdition({ key: '/books/OL1M', title: crusoe }, { authors: [committee] });
    expect(ol.title).toBe(crusoe);
    expect(ol.authors).toEqual([committee]);
    expect(validateBookDraft(candidateToDraft(ol)).ok).toBe(true);
  });

  it('are shortened at a word, with an ellipsis, past 1000 characters, so the book can still be edited', () => {
    const endless = `${crusoe} `.repeat(5);
    const name = `${committee} `.repeat(5);
    const ol = mapEdition({ key: '/books/OL1M', title: endless }, { authors: [name] });
    const gb = mapVolume({ id: 'v1', volumeInfo: { title: endless, authors: [name] } })!;
    for (const candidate of [ol, gb]) {
      expect(candidate.title.length).toBeLessThanOrEqual(1000);
      expect(candidate.title.endsWith('…')).toBe(true);
      expect(endless.startsWith(candidate.title.slice(0, -1).trimEnd())).toBe(true);
      expect(candidate.authors[0].length).toBeLessThanOrEqual(1000);
      expect(validateBookDraft(candidateToDraft(candidate)).ok).toBe(true);
    }
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
