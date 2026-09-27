/**
 * @jest-environment node
 */
import { createHttpClient, createRateLimiter } from '@/services/http';
import { createFixtureFetch } from '@/testing/fixtureFetch';

import { googleBooksRoutes } from '../__fixtures__/googleBooksRoutes';
import { olFixtures, openLibraryRoutes } from '../__fixtures__/openLibraryRoutes';
import { makeCandidate } from '../candidate';
import { createDefaultMetadataService } from '../index';
import { mapSearchDoc } from '../openLibraryMap';
import { languageMatch, rankCandidates, rankEditions, RANK_WEIGHTS, scoreCandidate } from '../rank';

const base = (title: string, extra: Partial<Parameters<typeof makeCandidate>[0]> = {}) =>
  makeCandidate({ title, source: 'openlibrary', sourceId: title, ...extra });

describe('scoreCandidate', () => {
  const q = { title: 'the colour of magic', author: 'pratchett' };

  it.each([
    ['exact title', base('The Colour of Magic'), RANK_WEIGHTS.exactTitle],
    ['exact title, different case and article', base('Colour Of Magic'), RANK_WEIGHTS.exactTitle],
    ['title containing the query', base('The Colour of Magic / The Light Fantastic'), RANK_WEIGHTS.partialTitle],
    ['unrelated title', base('Mort'), 0],
    ['author match only', base('Mort', { authors: ['Terry Pratchett'] }), RANK_WEIGHTS.author],
    ['ISBN only', base('Mort', { isbn13: '9780552131063' }), RANK_WEIGHTS.isbn],
    ['cover only', base('Mort', { coverUrl: 'https://x.test/c.jpg' }), RANK_WEIGHTS.cover],
    ['edition count 9 → log10(10) = 1', base('Mort', { editionCount: 9 }), 1],
    ['edition count capped', base('Mort', { editionCount: 100_000 }), RANK_WEIGHTS.editionCountMax],
  ])('%s', (_label, candidate, expected) => {
    expect(scoreCandidate(candidate, q)).toBeCloseTo(expected, 5);
  });

  it('scores free text by title words and author names found in it', () => {
    const text = { text: 'DUNE FRANK HERBERT' };
    expect(scoreCandidate(base('Dune', { authors: ['Frank Herbert'] }), text)).toBe(RANK_WEIGHTS.exactTitle + RANK_WEIGHTS.author);
    expect(scoreCandidate(base('Dune Messiah', { authors: ['Frank Herbert'] }), text)).toBe(
      RANK_WEIGHTS.partialTitle / 2 + RANK_WEIGHTS.author,
    );
    expect(scoreCandidate(base('Mort', { authors: ['Terry Pratchett'] }), text)).toBe(0);
  });
});

describe('rankCandidates', () => {
  it('puts the exact work first for the recorded Open Library search', () => {
    const docs = olFixtures.searchColourOfMagic.docs.map(mapSearchDoc).filter((c) => c !== null);
    const ranked = rankCandidates([...docs].reverse(), { title: 'the colour of magic', author: 'pratchett' });
    expect(ranked[0]).toMatchObject({ title: 'The Colour of Magic', workKey: 'OL453657W' });
    expect(ranked[0].confidence).toBeGreaterThan(ranked[1].confidence);
  });

  it('is stable: equal scores keep their incoming order', () => {
    const items = ['A', 'B', 'C', 'D'].map((t) => base(`Unrelated ${t}`));
    const ranked = rankCandidates(items, { title: 'something else' });
    expect(ranked.map((c) => c.title)).toEqual(['Unrelated A', 'Unrelated B', 'Unrelated C', 'Unrelated D']);
    expect(rankCandidates(ranked, { title: 'something else' }).map((c) => c.title)).toEqual(ranked.map((c) => c.title));
  });

  it('sets confidence to the score as a fraction of the maximum', () => {
    const perfect = base('Dune', { authors: ['Frank Herbert'], isbn13: '9780441172719', coverUrl: 'x', editionCount: 1e9 });
    expect(rankCandidates([perfect], { title: 'Dune', author: 'Herbert' })[0].confidence).toBe(1);
    expect(rankCandidates([base('Mort')], { title: 'Dune' })[0].confidence).toBe(0);
  });

  it('ranks the merged results of both providers for a title + author search', async () => {
    const fixtures = createFixtureFetch(openLibraryRoutes, googleBooksRoutes);
    const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }) });
    const service = createDefaultMetadataService({ http });
    const { candidates, warnings } = await service.search({ title: 'the colour of magic', author: 'pratchett' });
    expect(warnings).toEqual([]);
    expect(fixtures.unmocked).toEqual([]);
    expect(candidates.map((c) => [c.title, c.source, c.isbn13])).toEqual([
      // The Open Library work, merged with the first Google Books edition of the same title.
      ['The Colour of Magic', 'openlibrary', '9780061020711'],
      ['The Colour Of Magic', 'googlebooks', '9780552166591'],
      // Omnibuses containing the title outrank another book by the same author.
      ['The Colour of Magic / The Light Fantastic', 'openlibrary', null],
      ['The Colour of Magic, The Light Fantastic, Equal Rites', 'openlibrary', null],
      ["Terry Pratchett's The colour of magic", 'openlibrary', null],
      ['The Light Fantastic', 'googlebooks', '9780552166607'],
    ]);
    expect(candidates[0]).toMatchObject({ workKey: 'OL453657W', editionCount: 93, kind: 'edition' });
  });
});

describe('language preference in search results', () => {
  const en = { code: 'en', detected: true } as const;
  const enLocale = { code: 'en', detected: false } as const;

  it('matches a work when any of its editions is in the language, an edition by its own', () => {
    expect(languageMatch(base('W', { kind: 'work', languages: ['en', 'nl'] }), 'en')).toBe(1);
    expect(languageMatch(base('W', { kind: 'work', languages: ['es'] }), 'en')).toBe(0);
    expect(languageMatch(base('E', { language: 'nl' }), 'nl')).toBe(1);
    expect(languageMatch(base('E'), 'en')).toBe(0.5);
  });

  it('settles otherwise equal works: "Nobody\'s Girl" in English before the Spanish translation', () => {
    const spanish = base("Nobody's Girl", { kind: 'work', languages: ['es'], authors: ['Virginia Roberts Giuffre'] });
    const english = base("Nobody's Girl", { kind: 'work', languages: ['en'], authors: ['Virginia Roberts Giuffre'] });
    const q = { title: "Nobody's Girl", author: 'Giuffre' };
    expect(rankCandidates([spanish, english], q).map((c) => c.languages)).toEqual([['es'], ['en']]);
    expect(rankCandidates([spanish, english], { ...q, language: en }).map((c) => c.languages)).toEqual([['en'], ['es']]);
    expect(rankCandidates([spanish, english], { ...q, language: enLocale }).map((c) => c.languages)).toEqual([['en'], ['es']]);
  });

  it('never outweighs the title or the author', () => {
    const right = base('Practical Magic', { kind: 'work', languages: ['nl'], authors: ['Alice Hoffman'] });
    const wrong = base('Practical Guide', { kind: 'work', languages: ['en'], authors: ['Someone Else'] });
    expect(rankCandidates([wrong, right], { title: 'Practical Magic', author: 'Hoffman', language: en })[0].title).toBe('Practical Magic');
  });

  it('counts in the confidence only when asked for', () => {
    const perfect = base('Dune', { authors: ['Frank Herbert'], isbn13: '9780441172719', coverUrl: 'x', editionCount: 1e9, language: 'en' });
    expect(rankCandidates([perfect], { title: 'Dune', author: 'Herbert', language: en })[0].confidence).toBe(1);
    expect(rankCandidates([perfect], { title: 'Dune', author: 'Herbert' })[0].confidence).toBe(1);
  });
});

describe('rankEditions', () => {
  // The three editions of "Problematic Summer Romance" (OL43548572W), in Open Library's order, September 2026.
  const covers = (id: number) => ({ olEditionCoverIds: [id], olWorkCoverIds: [], googleVolumeId: null, googleImageUrl: null });
  const vanGoor = base('Problematic Summer Romance', {
    subtitle: 'Soms wordt een cliché de allerbeste plottwist', publisher: 'Van Goor', publicationYear: 2025, isbn13: '9789000400973', language: 'nl', coverRefs: covers(15165839),
  });
  const littleBrown = base('Problematic Summer Romance', {
    publisher: 'Little, Brown Book Group', publicationYear: 2025, isbn13: '9781408729885', language: 'en', coverRefs: covers(15165838),
  });
  const berkley = base('Problematic Summer Romance', {
    publisher: 'Berkley', publicationYear: 2025, isbn13: '9798217188123', language: 'en', coverRefs: covers(15096054),
  });
  const olOrder = [vanGoor, littleBrown, berkley];
  const title = 'Problematic Summer Romance';

  it('puts the language read on the cover first: never the Dutch edition for an English cover', () => {
    const ranked = rankEditions(olOrder, { language: { code: 'en', detected: true }, title });
    expect(ranked.map((e) => e.language)).toEqual(['en', 'en', 'nl']);
    expect(ranked[0]).toBe(littleBrown);
  });

  it("falls back on the app's language when the cover's is unknown", () => {
    expect(rankEditions(olOrder, { language: { code: 'en', detected: false }, title })[0].language).toBe('en');
  });

  it('reads a Dutch cover as Dutch', () => {
    expect(rankEditions(olOrder, { language: { code: 'nl', detected: true }, title })[0]).toBe(vanGoor);
  });

  it('keeps the provider order with nothing to go on', () => {
    expect(rankEditions(olOrder)).toEqual(olOrder);
  });

  it('a detected language outranks everything; unknown languages come between', () => {
    const bare = base('Problematic Summer Romance', { language: 'en' });
    const unknown = base('Problematic Summer Romance', { publisher: 'X', publicationYear: 2025, isbn13: '9781408729885', coverRefs: covers(1) });
    const ranked = rankEditions([vanGoor, unknown, bare], { language: { code: 'en', detected: true }, title });
    expect(ranked).toEqual([bare, unknown, vanGoor]);
  });

  it("the app's language gives way to a much closer title (a Spanish cover read without a language)", () => {
    const original = base('Cien años de soledad', { language: 'es', publisher: 'Debolsillo', publicationYear: 2003, coverRefs: covers(2) });
    const translation = base('One Hundred Years of Solitude', { language: 'en', publisher: 'Harper', publicationYear: 2006, coverRefs: covers(3) });
    expect(rankEditions([translation, original], { language: { code: 'en', detected: false }, title: 'Cien años de soledad' })[0]).toBe(original);
  });

  it('prefers the title asked for, a cover, a fuller record, then the newest', () => {
    const guide = base('Lektürehilfen Der Vorleser', { language: 'de', publisher: 'Klett', publicationYear: 2005, coverRefs: covers(4) });
    const novel = base('Der Vorleser', { language: 'de', publisher: 'Diogenes', publicationYear: 1997, coverRefs: covers(5) });
    const bare = base('Der Vorleser', { language: 'de', publisher: 'Diogenes', publicationYear: 1997 });
    const newer = base('Der Vorleser', { language: 'de', publisher: 'Diogenes', publicationYear: 2011, coverRefs: covers(6) });
    const ranked = rankEditions([guide, bare, novel, newer], { language: { code: 'de', detected: true }, title: 'Der Vorleser' });
    expect(ranked).toEqual([newer, novel, bare, guide]);
  });

  it('prefers an edition with a cover to one without (the 2023 "Practical Magic" had none)', () => {
    const deluxe = base('Practical Magic', { language: 'en', publisher: 'Penguin Publishing Group', publicationYear: 2023, isbn13: '9780593718148' });
    const vintage = base('Practical Magic', { language: 'en', publisher: 'Vintage Books', publicationYear: 2002, isbn13: '9780099429173', pageCount: 280, coverRefs: covers(14809819) });
    expect(rankEditions([deluxe, vintage], { language: { code: 'en', detected: true }, title: 'Practical Magic' })[0]).toBe(vintage);
  });
});
