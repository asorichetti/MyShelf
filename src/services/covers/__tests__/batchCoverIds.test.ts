/**
 * @jest-environment node
 */
import { createHttpClient, createRateLimiter, OfflineError } from '@/services/http';
import batch from '@/services/metadata/__fixtures__/openlibrary/search-isbn-batch.json';
import { createFixtureFetch, type FixtureRoutes } from '@/testing/fixtureFetch';

import { COVER_BATCH_SIZE, coverBatchUrl, coverSourcesFromBatch, findCoverIdsByIsbn, searchIsbn13 } from '../batchCoverIds';

const GOOD_OMENS = '9780060853983';
const DUNE = '9780441172719';
const FELLOWSHIP = '9780345339706';
const FARTHEST_SHORE = '9780140306941';
const UNKNOWN = '9791099999993';

function client(routes: FixtureRoutes) {
  const fixtures = createFixtureFetch(routes);
  const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });
  return { http, fixtures };
}

describe('searchIsbn13', () => {
  it('uses the ISBN-13, or derives it from the ISBN-10', () => {
    expect(searchIsbn13({ isbn13: GOOD_OMENS, isbn10: null })).toBe(GOOD_OMENS);
    expect(searchIsbn13({ isbn13: null, isbn10: '0441172717' })).toBe(DUNE);
    expect(searchIsbn13({ isbn13: 'nonsense', isbn10: null })).toBeNull();
    expect(searchIsbn13({})).toBeNull();
  });
});

describe('coverBatchUrl', () => {
  it('asks for every ISBN in one sorted, de-duplicated query', () => {
    const url = coverBatchUrl([GOOD_OMENS, DUNE, GOOD_OMENS]);
    expect(url).toBe(coverBatchUrl([DUNE, GOOD_OMENS]));
    expect(decodeURIComponent(url)).toBe(
      `https://openlibrary.org/search.json?q=isbn:(${GOOD_OMENS} OR ${DUNE})&fields=key,cover_i,editions,editions.key,editions.cover_i,editions.isbn&limit=100`,
    );
  });
});

describe('coverSourcesFromBatch (recorded answer)', () => {
  const found = coverSourcesFromBatch(batch, [GOOD_OMENS, DUNE, FELLOWSHIP, FARTHEST_SHORE, UNKNOWN]);

  it('takes the matching edition’s cover id and OLID, and its work’s cover id', () => {
    expect(found.get(GOOD_OMENS)).toEqual({ isbn13: GOOD_OMENS, olEditionCoverIds: [10482245], olEditionId: 'OL7283145M', olWorkCoverIds: [10482258] });
  });

  it('matches an edition listed under either ISBN form', () => {
    expect(found.get(DUNE)?.olEditionCoverIds).toEqual([7885536]);
  });

  it('prefers the work whose matching edition has a cover (the single volume over the box set)', () => {
    // 9780345339706 is in both The Fellowship of the Ring and The Lord of the Rings (no edition cover).
    expect(found.get(FELLOWSHIP)).toMatchObject({ olEditionCoverIds: [14625981], olEditionId: 'OL26451576M', olWorkCoverIds: [14627060] });
  });

  it('keeps the work cover when the edition has none', () => {
    expect(found.get(FARTHEST_SHORE)).toMatchObject({ olEditionCoverIds: [], olWorkCoverIds: [6498990] });
  });

  it('leaves out ISBNs the answer does not mention', () => {
    expect(found.has(UNKNOWN)).toBe(false);
  });

  it('copes with an empty or odd answer', () => {
    expect(coverSourcesFromBatch({}, [GOOD_OMENS]).size).toBe(0);
    expect(coverSourcesFromBatch({ docs: [{ key: '/works/OL1W', cover_i: -1, editions: { docs: [{ isbn: [GOOD_OMENS], cover_i: -1 }] } }] }, [GOOD_OMENS]).get(GOOD_OMENS)).toEqual({
      isbn13: GOOD_OMENS,
      olEditionCoverIds: [],
      olEditionId: null,
      olWorkCoverIds: [],
    });
  });
});

describe('findCoverIdsByIsbn', () => {
  const isbns = [GOOD_OMENS, DUNE, FELLOWSHIP, FARTHEST_SHORE, UNKNOWN];

  it('makes one request for a whole import', async () => {
    const { http, fixtures } = client({ [coverBatchUrl(isbns)]: { body: batch } });
    const found = await findCoverIdsByIsbn(http, isbns);
    expect(fixtures.calls).toEqual([coverBatchUrl(isbns)]);
    expect([...found.keys()].sort()).toEqual([GOOD_OMENS, DUNE, FELLOWSHIP, FARTHEST_SHORE].sort());
    expect(COVER_BATCH_SIZE).toBeGreaterThanOrEqual(20);
  });

  it('splits many ISBNs into chunks and merges their answers', async () => {
    const chunks = [isbns.slice(0, 2), isbns.slice(2, 4), isbns.slice(4)];
    const { http, fixtures } = client(Object.fromEntries(chunks.map((c) => [coverBatchUrl(c), { body: batch }])));
    const found = await findCoverIdsByIsbn(http, isbns, { batchSize: 2 });
    expect(fixtures.calls).toEqual(chunks.map(coverBatchUrl));
    expect(found.size).toBe(4);
  });

  it('leaves out the books of a chunk that failed, and keeps the rest', async () => {
    const { http } = client({ [coverBatchUrl(isbns.slice(0, 2))]: { status: 500, text: 'oops' }, [coverBatchUrl(isbns.slice(2, 4))]: { body: batch }, [coverBatchUrl(isbns.slice(4))]: { text: 'not json' } });
    const found = await findCoverIdsByIsbn(http, isbns, { batchSize: 2 });
    expect([...found.keys()].sort()).toEqual([FELLOWSHIP, FARTHEST_SHORE].sort());
  });

  it('rejects when offline, so the backfill stops without recording anything', async () => {
    const http = createHttpClient({
      fetch: async () => Promise.reject(new TypeError('Network request failed')),
      limiter: createRateLimiter({ minIntervalMs: 0 }),
      retryDelaysMs: [],
    });
    await expect(findCoverIdsByIsbn(http, isbns)).rejects.toBeInstanceOf(OfflineError);
  });

  it('asks nothing for no ISBNs', async () => {
    const { http, fixtures } = client({});
    expect((await findCoverIdsByIsbn(http, [])).size).toBe(0);
    expect(fixtures.calls).toEqual([]);
  });
});
