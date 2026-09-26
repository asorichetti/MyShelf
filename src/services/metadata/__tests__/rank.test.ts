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
import { rankCandidates, RANK_WEIGHTS, scoreCandidate } from '../rank';

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
