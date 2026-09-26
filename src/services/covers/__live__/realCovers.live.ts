// Live check that well-known books get real cover art, end to end against the
// real Open Library APIs: ISBN lookup -> merged candidate -> cover chain ->
// validated image. It uses the network, so it is not part of `npm test`; run it
// with `npm run test:live`. Set LIVE_COVERS_OUT=<dir> to save each chosen
// cover for a visual check.
//
// It runs under Node's test runner rather than Jest: the jest-expo preset
// replaces fetch and other web globals with stubs meant for native tests.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { createHttpClient, createRateLimiter } from '@/services/http';
import { formatUserAgent } from '@/services/http/userAgent.shared';
import { createDefaultMetadataService } from '@/services/metadata';

import { coverSourceFromCandidate } from '../coverSource';
import { resolveCover } from '../resolveCover';

const books = [
  { isbn: '9780575048003', title: 'Good Omens' },
  { isbn: '9780060853983', title: 'Good Omens' },
  { isbn: '9780441172719', title: 'Dune' },
  { isbn: '9780441013593', title: 'Dune' },
  { isbn: '9780552166591', title: 'The Colour of Magic' },
  { isbn: '9780141439518', title: 'Pride and Prejudice' },
  { isbn: '9780553418026', title: 'The Martian' },
  { isbn: '9780547928227', title: 'The Hobbit' },
];

const http = createHttpClient({
  userAgent: formatUserAgent('live-test'),
  limiter: createRateLimiter({ minIntervalMs: 1000 }),
  timeoutMs: 20_000,
});
// Keyless Google Books is quota-blocked, and its covers are only a fallback;
// this checks the Open Library path that every user gets.
const metadata = createDefaultMetadataService({ http, isGoogleBooksEnabled: () => false });
const outDir = process.env.LIVE_COVERS_OUT;

describe('real cover art for well-known books (live)', () => {
  for (const { isbn, title } of books) {
    it(`${title} (${isbn}) gets a real portrait cover`, { timeout: 120_000 }, async () => {
      const { candidates } = await metadata.lookupIsbn(isbn);
      assert.ok(candidates.length > 0, `no Open Library record for ${isbn}`);
      const candidate = candidates[0];
      assert.match(candidate.title, new RegExp(title.replace(/^The /, ''), 'i'));

      const { cover, tried } = await resolveCover(coverSourceFromCandidate(candidate), { http });
      assert.ok(cover, `no cover for ${title} (${isbn}); tried: ${JSON.stringify(tried)}`);
      assert.match(cover.url, /^https:\/\/covers\.openlibrary\.org\//);
      assert.equal(cover.shape, 'portrait');
      assert.ok(cover.height >= 400, `cover is only ${cover.width}x${cover.height}`);
      assert.ok(cover.bytes.length > 10_000, `cover is only ${cover.bytes.length} bytes`);

      if (outDir) {
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, `${isbn}.${cover.format === 'jpeg' ? 'jpg' : cover.format}`), cover.bytes);
      }
      console.log(`${title} (${isbn}): ${cover.origin} ${cover.width}x${cover.height} ${cover.url}`);
    });
  }
});
