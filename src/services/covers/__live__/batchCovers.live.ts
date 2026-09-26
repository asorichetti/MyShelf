// Live check of the cover backfill's batch search against the real Open
// Library: one request finds cover ids for every book of the Goodreads
// export fixture that has an ISBN, and each leads to a real portrait cover.
// It uses the network, so it is not part of `npm test`; run it with
// `npm run test:live`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { APP_RATE_RULES, createHttpClient, createRateLimiter } from '@/services/http';
import { formatUserAgent } from '@/services/http/userAgent.shared';

import { coverBatchUrl, findCoverIdsByIsbn } from '../batchCoverIds';
import { resolveCover } from '../resolveCover';

/** The Goodreads fixture's ISBN-13s (Dune's derived from its ISBN-10; The Colour of Magic has none). */
const GOODREADS = {
  '9780060853983': 'Good Omens',
  '9780547928227': 'The Hobbit',
  '9780451524935': '1984',
  '9780756404741': 'The Name of the Wind',
  '9780765350381': 'The Final Empire',
  '9780593135204': 'Project Hail Mary',
  '9780316556347': 'Circe',
  '9781984880963': 'The Thursday Murder Club',
  '9780316129084': 'Leviathan Wakes',
  '9780441478125': 'The Left Hand of Darkness',
  '9780393609097': 'Norse Mythology',
  '9780393316049': 'Surely You’re Joking, Mr. Feynman!',
  '9780091865153': 'The Science of Discworld',
  '9780451419439': 'Les Misérables',
  '9780441172719': 'Dune',
  '9780553418026': 'The Martian',
  '9780345339706': 'The Fellowship of the Ring',
  '9780141439518': 'Pride and Prejudice',
  '9780747532699': "Harry Potter and the Philosopher's Stone",
} as const;

const requests: string[] = [];
const http = createHttpClient({
  userAgent: formatUserAgent('live-test'),
  limiter: createRateLimiter({ rules: APP_RATE_RULES }),
  timeoutMs: 20_000,
  fetch: (url, init) => {
    requests.push(url);
    return fetch(url, init);
  },
});

describe('batch cover ids for an imported library (live)', () => {
  it('finds a cover for every Goodreads book with an ISBN in one request, each a real portrait cover', { timeout: 180_000 }, async () => {
    const isbns = Object.keys(GOODREADS);
    const found = await findCoverIdsByIsbn(http, isbns);
    assert.deepEqual(requests, [coverBatchUrl(isbns)]);
    assert.deepEqual(
      isbns.filter((i) => !found.has(i)).map((i) => GOODREADS[i as keyof typeof GOODREADS]),
      [],
      'books the batch search did not find',
    );

    const results = await Promise.all(
      isbns.map(async (isbn) => {
        const { cover, tried } = await resolveCover(found.get(isbn)!, { http, includeGoogle: false });
        return { title: GOODREADS[isbn as keyof typeof GOODREADS], cover, tried };
      }),
    );
    for (const { title, cover, tried } of results) {
      assert.ok(cover, `${title}: no cover; tried ${JSON.stringify(tried)}`);
      assert.match(cover.url, /^https:\/\/covers\.openlibrary\.org\/b\/id\//, `${title}: ${cover.url}`);
      assert.equal(cover.shape, 'portrait', `${title}: ${cover.width}x${cover.height}`);
      assert.ok(cover.height >= 400, `${title}: only ${cover.width}x${cover.height}`);
      console.log(`${title}: ${cover.origin} ${cover.width}x${cover.height} ${cover.url}`);
    }
  });
});
