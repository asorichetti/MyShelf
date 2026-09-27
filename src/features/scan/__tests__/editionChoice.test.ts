/**
 * @jest-environment node
 */
import { coverCandidates, coverSourceFromCandidate } from '@/services/covers';
import { makeCandidate, type BookCandidate } from '@/services/metadata';
import { emptyCoverRefs } from '@/services/metadata/candidate';

import { enrichEdition, groupByWork, orderEditions } from '../editionChoice';

const OL = 'https://covers.openlibrary.org/b';

/** An Open Library edition as `editions.json` gives it: no work, so no work cover. */
const edition = (title: string, extra: Partial<BookCandidate> & { covers?: number[] } = {}) => {
  const { covers = [], ...rest } = extra;
  return makeCandidate({
    title,
    source: 'openlibrary',
    sourceId: `OL${Math.round(Math.random() * 1e8)}M`,
    authors: [],
    coverRefs: { ...emptyCoverRefs(), olEditionCoverIds: covers },
    ...rest,
  });
};

// "Problematic Summer Romance" by Ali Hazelwood (OL43548572W), as Open Library listed it in September 2026.
const psrWork = makeCandidate({
  kind: 'work',
  title: 'Problematic Summer Romance',
  authors: ['Ali Hazelwood'],
  workKey: 'OL43548572W',
  languages: ['en', 'nl'],
  source: 'openlibrary',
  sourceId: 'OL43548572W',
  coverRefs: { ...emptyCoverRefs(), olWorkCoverIds: [15096054] },
});
const psrEditions = [
  edition('Problematic Summer Romance', { subtitle: 'Soms wordt een cliché de allerbeste plottwist', publisher: 'Van Goor', publicationYear: 2025, isbn13: '9789000400973', language: 'nl', covers: [15165839] }),
  edition('Problematic Summer Romance', { publisher: 'Little, Brown Book Group', publicationYear: 2025, isbn13: '9781408729885', language: 'en', covers: [15165838] }),
  edition('Problematic Summer Romance', { publisher: 'Berkley', publicationYear: 2025, isbn13: '9798217188123', language: 'en', covers: [15096054] }),
];

// "Practical Magic" by Alice Hoffman (OL48905W): the first edition listed, a 2023 reissue, has no cover.
const pmWork = makeCandidate({
  kind: 'work',
  title: 'Practical Magic',
  authors: ['Alice Hoffman'],
  workKey: 'OL48905W',
  languages: ['nl', 'pt', 'de', 'fr', 'en'],
  source: 'openlibrary',
  sourceId: 'OL48905W',
  coverRefs: { ...emptyCoverRefs(), olWorkCoverIds: [14810040] },
});
const deluxe = edition('Practical Magic', { publisher: 'Penguin Publishing Group', publicationYear: 2023, isbn13: '9780593718148', language: 'en' });
const pmEditions = [
  deluxe,
  edition('Magische praktijken', { publisher: 'Anthos', publicationYear: 1996, isbn13: '9789041400161', language: 'nl', covers: [14810662] }),
  edition('Practical Magic', { publisher: 'Penguin Publishing Group', publicationYear: 1998, isbn13: '9780425163207', language: 'en' }),
  edition('Practical Magic', { publisher: 'Vintage Books', publicationYear: 2002, isbn13: '9780099429173', language: 'en', pageCount: 280, covers: [14809819, 73961] }),
  edition('Practical Magic', { publisher: 'Berkley Trade', publicationYear: 2003, isbn13: '9780425190371', language: 'en', pageCount: 286, covers: [15126599, 272475] }),
  edition('Practical magic', { publisher: 'Putnam', publicationYear: 1995, language: 'en', covers: [14810040, 3889279] }),
];

const english = { code: 'en', detected: true };

describe('orderEditions', () => {
  it('opens an English cover of "Problematic Summer Romance" on an English edition, the Dutch one last', () => {
    const [group] = groupByWork([psrWork]);
    const ordered = orderEditions(group, psrEditions, { language: english, title: 'PROBLEMATIC SUMMER BROMANCE' });
    expect(ordered.map((e) => e.language)).toEqual(['en', 'en', 'nl']);
    expect(ordered[0].isbn13).not.toBe('9789000400973');
  });

  it('offers a "Practical Magic" edition with a cover first, not the bare 2023 reissue', () => {
    const [group] = groupByWork([pmWork]);
    const ordered = orderEditions(group, pmEditions, { language: english, title: 'PRACTICAL MAGIC' });
    expect(ordered[0].coverRefs.olEditionCoverIds.length).toBeGreaterThan(0);
    expect(ordered[0].language).toBe('en');
    expect(ordered.at(-1)!.language).toBe('nl');
  });

  it("uses the app's language, more weakly, when the cover's is unknown", () => {
    const [group] = groupByWork([psrWork]);
    expect(orderEditions(group, psrEditions, { language: { code: 'en', detected: false } })[0].language).toBe('en');
  });
});

describe('enrichEdition: covers for the chain', () => {
  it("gives an edition from the picker its work's cover, then other editions' covers (same language first)", () => {
    const [group] = groupByWork([pmWork]);
    const siblings = orderEditions(group, pmEditions, { language: english, title: 'Practical Magic' });
    const chosen = enrichEdition(deluxe, group, siblings);
    expect(chosen.coverRefs.olEditionCoverIds).toEqual([]);
    expect(chosen.coverRefs.olWorkCoverIds).toEqual([14810040]);
    // "Review before saving" shows the work's cover on the card.
    expect(chosen.coverUrl).toBe(`${OL}/id/14810040-L.jpg`);
    // Newest first among equals; the work's own cover (Putnam's) is not repeated; the Dutch art comes after every English one.
    expect(chosen.coverRefs.olOtherEditionCoverIds).toEqual([15126599, 14809819, 14810662]);
  });

  it('the cover chain then tries the work cover right after the edition, and other editions last', () => {
    const [group] = groupByWork([pmWork]);
    const chosen = enrichEdition(deluxe, group, orderEditions(group, pmEditions, { language: english }));
    expect(coverCandidates(coverSourceFromCandidate(chosen), { includeGoogle: false }).map((c) => `${c.origin} ${c.url}`)).toEqual([
      `openlibrary-olid ${OL}/olid/${deluxe.sourceId}-L.jpg?default=false`,
      `openlibrary-work ${OL}/id/14810040-L.jpg`,
      `openlibrary-isbn13 ${OL}/isbn/9780593718148-L.jpg?default=false`,
      `openlibrary-isbn10 ${OL}/isbn/0593718143-L.jpg?default=false`,
      `openlibrary-other-edition ${OL}/id/15126599-L.jpg`,
      `openlibrary-other-edition ${OL}/id/14809819-L.jpg`,
    ]);
  });

  it('keeps cover ids the edition already has, and adds nothing without a group', () => {
    const [group] = groupByWork([psrWork]);
    const own = psrEditions[1];
    const chosen = enrichEdition(own, group, psrEditions);
    expect(chosen.coverRefs.olEditionCoverIds).toEqual([15165838]);
    expect(chosen.coverRefs.olWorkCoverIds).toEqual([15096054]);
    // Berkley's cover is the work's; only Van Goor's is left as another edition's art.
    expect(chosen.coverRefs.olOtherEditionCoverIds).toEqual([15165839]);
    expect(enrichEdition(own, null)).toBe(own);
  });

  it('a work chosen itself (no editions listed) keeps its own cover', () => {
    const [group] = groupByWork([pmWork]);
    const chosen = enrichEdition(pmWork, group, []);
    expect(chosen.coverRefs.olWorkCoverIds).toEqual([14810040]);
  });
});
