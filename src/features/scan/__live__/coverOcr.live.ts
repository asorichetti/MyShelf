// Live check of the cover path end to end on real captures: OCR text (the
// Apple Vision stand-in captures in src/domain/__fixtures__/ocr/real-*.json)
// -> buildQueriesFromOcr -> searchCover against the real Open Library ->
// the top candidate must be the right book, with a real cover. It uses the
// network, so it is not part of `npm test`; run it with `npm run test:live`.
//
// Node's test runner rather than Jest: the jest-expo preset replaces fetch.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { buildQueriesFromOcr, sameAuthor, titleSimilarity, type OcrResult } from '@/domain';
import { coverSourceFromCandidate } from '@/services/covers/coverSource';
import { resolveCover } from '@/services/covers/resolveCover';
import { createHttpClient, createRateLimiter } from '@/services/http';
import { formatUserAgent } from '@/services/http/userAgent.shared';
import { createDefaultMetadataService } from '@/services/metadata';

import { searchCover } from '../coverSearch';

interface Capture {
  synthetic: boolean;
  expected: { title: string; author: string };
  result: OcrResult;
}

const dir = join(import.meta.dirname, '..', '..', '..', 'domain', '__fixtures__', 'ocr');
const captures = readdirSync(dir)
  .filter((f) => f.startsWith('real-') && f.endsWith('.json'))
  .map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8')) as Capture] as const);

const http = createHttpClient({
  userAgent: formatUserAgent('live-test'),
  limiter: createRateLimiter({ minIntervalMs: 1000 }),
  timeoutMs: 20_000,
});
// Keyless Google Books is quota-blocked; this checks the Open Library path every user gets.
const metadata = createDefaultMetadataService({ http, isGoogleBooksEnabled: () => false });

describe('real cover captures find the right book (live)', () => {
  it('has the real captures', () => assert.ok(captures.length >= 3, `found ${captures.length}`));

  for (const [file, capture] of captures) {
    const { title, author } = capture.expected;
    it(`${file}: ${title} by ${author}`, { timeout: 180_000 }, async () => {
      assert.equal(capture.synthetic, false);
      const queries = buildQueriesFromOcr(capture.result);
      const { candidates, step, tried } = await searchCover((q, signal) => metadata.search(q, { signal }), queries);
      const top = candidates[0];
      const report = JSON.stringify({ queries, step, tried, top: top && { title: top.title, authors: top.authors, workKey: top.workKey } });
      process.stderr.write(`${file}: ${report}\n`);
      assert.ok(top, `nothing found: ${report}`);
      assert.ok(titleSimilarity(top.title, title) >= 0.9, `top candidate is ${JSON.stringify(top.title)}, not ${JSON.stringify(title)}: ${report}`);
      assert.ok(top.authors.some((a) => sameAuthor(a, author)), `top candidate is by ${JSON.stringify(top.authors)}, not ${author}: ${report}`);

      const { cover, tried: covers } = await resolveCover(coverSourceFromCandidate(top), { http, includeGoogle: false });
      assert.ok(cover, `no real cover for ${title}: ${JSON.stringify(covers)}`);
      assert.match(cover.url, /^https:\/\/covers\.openlibrary\.org\//);
      assert.ok(cover.height >= 150, `cover is only ${cover.width}x${cover.height}`);
      process.stderr.write(`${file}: cover ${cover.url} ${cover.width}x${cover.height} (${cover.origin})\n`);
    });
  }
});
