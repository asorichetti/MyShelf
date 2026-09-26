/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildQueriesFromOcr, closestByTitle, titleSimilarity, withoutWeakestWord, type OcrResult } from '@/domain';
import { makeCandidate } from '@/services/metadata/candidate';
import { createFixtureMetadata } from '@/testing/fixtureMetadata';

import { searchCover } from '../coverSearch';

const capture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'domain', '__fixtures__', 'ocr', `real-${name}.json`), 'utf8')) as { result: OcrResult };

/** Google Books is off, as in the live test: the recorded searches are Open Library's. */
function service() {
  const { service: s, fixtures } = createFixtureMetadata();
  return { search: s.search, fixtures };
}

describe('searchCover on the real captures, against recorded searches', () => {
  it('Problematic Summer Romance: the misread title finds nothing, so the author’s books are ranked by title', async () => {
    const { search } = service();
    const result = await searchCover((q, signal) => search(q, { signal }), buildQueriesFromOcr(capture('problematic-summer-romance').result));
    expect(result.tried[0]).toEqual({ title: 'problematic summer bromance', author: 'ali hazelwood' });
    expect(result.step).toBe('author');
    expect(result.used).toEqual({ author: 'ali hazelwood' });
    expect(result.candidates[0]).toMatchObject({ title: 'Problematic Summer Romance', authors: ['Ali Hazelwood'] });
    // Only books whose title is close to the cover's survive the author search.
    expect(result.candidates.every((c) => titleSimilarity(c.title, 'problematic summer bromance') >= 0.6)).toBe(true);
    expect(result.tried).toHaveLength(2);
  });

  it.each([
    ['practical-magic', 'Practical Magic', 'Alice Hoffman'],
    ['nobodys-girl', "Nobody's Girl", 'Virginia Roberts Giuffre'],
  ])('%s: title and author as read find it at once', async (name, title, author) => {
    const { search } = service();
    const result = await searchCover((q, signal) => search(q, { signal }), buildQueriesFromOcr(capture(name).result));
    expect(result.step).toBe('title-author');
    expect(result.tried).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ title, authors: [author] });
  });
});

describe('searchCover', () => {
  const book = (title: string) => makeCandidate({ title, source: 'openlibrary', sourceId: title, authors: ['A'] });

  it('tries the shortened title after the author, and stops after five searches', async () => {
    const calls: unknown[] = [];
    const search = jest.fn(async (q: unknown) => {
      calls.push(q);
      return { candidates: [], warnings: [] };
    });
    const queries = [{ title: 'one two three four', author: 'a b' }, { title: 'one two three four' }, { text: 'one two three four a b' }];
    const result = await searchCover(search, queries);
    expect(calls).toEqual([
      { title: 'one two three four', author: 'a b' },
      { author: 'a b' },
      { title: 'one two three', author: 'a b' },
      { title: 'one two three four' },
      { text: 'one two three four a b' },
    ]);
    expect(result).toMatchObject({ candidates: [], used: null, step: null });
    await searchCover(search, [...queries, { text: 'more' }, { text: 'even more' }]);
    expect(calls).toHaveLength(10);
  });

  it('ignores an author search whose books are all far from the cover’s title', async () => {
    const search = jest.fn(async (q: { author?: string; title?: string }) => ({
      candidates: q.author && !q.title ? [book('Something Else Entirely')] : q.title === 'the lost title' ? [book('The Lost Title')] : [],
      warnings: [],
    }));
    const result = await searchCover(search, [{ title: 'the lost titel', author: 'a b' }, { title: 'the lost title' }]);
    expect(result.step).toBe('title');
    expect(result.candidates[0].title).toBe('The Lost Title');
  });

  it('orders what it finds by closeness to the cover’s title', async () => {
    const search = jest.fn(async () => ({ candidates: [book('Dune Messiah'), book('Dune'), book('Children of Dune')], warnings: [] }));
    const result = await searchCover(search, [{ title: 'dune', author: 'frank herbert' }]);
    expect(result.candidates.map((c) => c.title)).toEqual(['Dune', 'Dune Messiah', 'Children of Dune']);
  });
});

describe('title matching helpers', () => {
  it.each([
    ['Problematic Summer Romance', 'problematic summer bromance', 0.9],
    ['The Colour of Magic', 'colour of magic', 1],
    ["Nobody's Girl", 'NOBODYS GIRL', 0.9],
    ['Dune', 'Dune Messiah', 0.3],
  ])('titleSimilarity(%j, %j) >= %s', (a, b, min) => {
    expect(titleSimilarity(a, b)).toBeGreaterThanOrEqual(min);
  });

  it('scores unrelated titles low', () => {
    expect(titleSimilarity('Practical Magic', 'The Rules of Magic')).toBeLessThan(0.6);
    expect(titleSimilarity('', 'x')).toBe(0);
  });

  it('closestByTitle keeps close titles, best first, stable', () => {
    const list = [{ title: 'Deep End' }, { title: 'Problematic Summer Romance' }, { title: 'Love, Theoretically' }];
    expect(closestByTitle(list, 'problematic summer bromance')).toEqual([{ title: 'Problematic Summer Romance' }]);
  });

  it('withoutWeakestWord drops the last word of titles of three words or more', () => {
    expect(withoutWeakestWord('problematic summer bromance')).toBe('problematic summer');
    expect(withoutWeakestWord('practical magic')).toBeNull();
  });
});
