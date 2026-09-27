// Live check of the cover path end to end on real captures: OCR text (in
// src/domain/__fixtures__/ocr/real-*.json: ML Kit read through the app on an
// Android emulator, real-mlkit-*, and the earlier Apple Vision stand-ins)
// -> buildQueriesFromOcr -> searchCover against the real Open Library ->
// the top candidate must be the right book, with a real cover. It uses the
// network, so it is not part of `npm test`; run it with `npm run test:live`.
//
// Node's test runner rather than Jest: the jest-expo preset replaces fetch.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  bookLanguagePreference,
  buildQueriesFromOcr,
  callNumber,
  detectOcrLanguage,
  normaliseGenres,
  sameAuthor,
  titleSimilarity,
  type OcrResult,
} from '@/domain';
import { coverSourceFromCandidate } from '@/services/covers/coverSource';
import { resolveCover } from '@/services/covers/resolveCover';
import { createHttpClient, createRateLimiter } from '@/services/http';
import { formatUserAgent } from '@/services/http/userAgent.shared';
import { createDefaultMetadataService } from '@/services/metadata';

import { searchCover } from '../coverSearch';
import { enrichEdition, groupByWork, orderEditions } from '../editionChoice';

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

// What the edition picker offers first for each ML Kit capture, and what saving it gives: the language
// read on the cover, the likeliest edition of the first work, enriched as the picker does, then its
// cover (by the chain the save uses), genres and call number (as the book page prints them).
const expectations: Record<string, (saved: { language: string | null; genres: string[]; call: string; coverOrigin: string }) => void> = {
  'real-mlkit-problematic-summer-romance.json': ({ language }) => {
    // The work has a Dutch edition (Van Goor, 9789000400973) that Open Library lists first.
    assert.equal(language, 'en', 'an English cover must give an English edition');
  },
  'real-mlkit-practical-magic.json': ({ coverOrigin }) => {
    // The 2023 reissue listed first has no cover; the photo must not be needed.
    assert.ok(coverOrigin, 'a real cover, not the photo');
  },
  'real-mlkit-nobodys-girl.json': ({ genres, call }) => {
    assert.ok(!genres.includes('Fiction'), `a memoir is not Fiction: ${genres.join(', ')}`);
    assert.ok(!call.startsWith('FIC'), `a memoir files under a non-fiction class, not ${call}`);
    assert.match(call, /^BIO GIU /);
  },
};

describe('the edition the picker offers first for the real ML Kit captures (live)', () => {
  for (const [file, capture] of captures.filter(([f]) => f in expectations)) {
    it(`${file}: ${capture.expected.title}`, { timeout: 240_000 }, async () => {
      const language = bookLanguagePreference(detectOcrLanguage(capture.result));
      assert.deepEqual(language, { code: 'en', detected: true }, 'the cover reads as English');
      const queries = buildQueriesFromOcr(capture.result);
      const { candidates } = await searchCover((q, signal) => metadata.search({ ...q, language }, { signal }), queries);
      const [group] = groupByWork(candidates);
      assert.ok(group, 'nothing found');
      const loaded = group.work.workKey ? await metadata.editions(group.work.workKey, { authors: group.work.authors }) : [];
      const editions = orderEditions(group, loaded, { language, title: queries[0]?.title });
      const chosen = enrichEdition(editions[0] ?? group.work, group, editions);
      const genres = normaliseGenres(chosen.subjects);
      // The book page lists genres alphabetically, which is what the call number sees.
      const call = callNumber({ genres: [...genres].sort(), author: chosen.authors[0] ?? null, title: chosen.title, year: chosen.publicationYear });
      const { cover, tried } = await resolveCover(coverSourceFromCandidate(chosen), { http, includeGoogle: false });
      const report = { edition: `${chosen.title} | ${chosen.publisher} ${chosen.publicationYear} | ${chosen.isbn13}`, language: chosen.language, genres, call, cover: cover && `${cover.origin} ${cover.width}x${cover.height}` };
      process.stderr.write(`${file}: ${JSON.stringify(report)}\n`);
      assert.ok(titleSimilarity(chosen.title, capture.expected.title) >= 0.9, JSON.stringify(report));
      assert.ok(cover, `no real cover (the photo would be offered): ${JSON.stringify(tried)}`);
      assert.ok(cover.height >= 150);
      expectations[file]({ language: chosen.language, genres, call, coverOrigin: cover.origin });
    });
  }

  it('Practical Magic: the 2023 reissue with no cover of its own, if picked, still gets the work cover (not the photo)', { timeout: 120_000 }, async () => {
    const { candidates } = await metadata.search({ title: 'practical magic', author: 'alice hoffman' });
    const [group] = groupByWork(candidates);
    const editions = orderEditions(group, await metadata.editions(group.work.workKey!, { authors: group.work.authors }), { language: { code: 'en', detected: true } });
    const reissue = editions.find((e) => e.isbn13 === '9780593718148');
    assert.ok(reissue, 'the 2023 reissue is listed');
    assert.equal(reissue.coverRefs.olEditionCoverIds.length, 0, 'it still has no cover of its own');
    const { cover, tried } = await resolveCover(coverSourceFromCandidate(enrichEdition(reissue, group, editions)), { http, includeGoogle: false });
    assert.ok(cover, `no cover: ${JSON.stringify(tried)}`);
    assert.equal(cover.origin, 'openlibrary-work');
  });
});

