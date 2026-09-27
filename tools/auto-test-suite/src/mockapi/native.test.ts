import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canonicalUrl, DefaultMockDir, loadMockIndex, matchRoute } from './index.ts';
import { buildNativeBundle, generateNativeBundle, NativeBundleMarker } from './native.ts';
import { canonicalUrl as nativeCanonicalUrl, createMockApiFetch } from '../../../../src/features/e2e/mockApiFetch.ts';
import { coverResponse } from '../browser/covers.ts';

const index = loadMockIndex(DefaultMockDir);
const bundle = buildNativeBundle(index);
const signal = new AbortController().signal;

test('the Android bundle is up to date with the fixture index (npm run e2eapi:gen)', () => {
  assert.equal(generateNativeBundle(DefaultMockDir, { check: true }).ok, true);
  assert.equal(bundle.marker, NativeBundleMarker);
  assert.equal(bundle.routes.length, index.routes.length);
});

test('the app’s canonical URLs are the web mock’s, for every recorded URL and reordered or re-escaped forms of them', () => {
  const samples = index.routes.filter((r) => !r.pattern).map((r) => r.url);
  for (const url of samples) {
    assert.equal(nativeCanonicalUrl(url), canonicalUrl(url), url);
    const [base, query] = url.split('?');
    if (!query) continue;
    const reordered = `${base}?${query.split('&').reverse().join('&')}`;
    assert.equal(nativeCanonicalUrl(reordered), canonicalUrl(reordered), reordered);
    const plus = reordered.replace(/%20/g, '+');
    assert.equal(nativeCanonicalUrl(plus), canonicalUrl(plus), plus);
  }
  for (const url of ['HTTPS://OpenLibrary.org:443/works/OL1W.json', 'https://openlibrary.org', "https://openlibrary.org/search.json?title=nobody's%20girl&x"]) {
    assert.equal(nativeCanonicalUrl(url), canonicalUrl(url), url);
  }
});

test('the app’s mock answers every recorded URL as the web mock does', async () => {
  const fetch = createMockApiFetch(bundle);
  for (const route of index.routes.filter((r) => !r.pattern)) {
    const web = matchRoute(index, route.url)!;
    const app = await fetch(route.url, { signal });
    assert.equal(app.status, web.status, route.url);
    assert.equal(app.headers.get('Content-Type'), web.contentType, route.url);
    const body = Buffer.from(await app.arrayBuffer());
    if (web.contentType.startsWith('application/json') && web.body.length) {
      assert.deepEqual(JSON.parse(body.toString('utf8')), JSON.parse(web.body.toString('utf8')), route.url);
    } else {
      assert.deepEqual(body, web.body, route.url);
    }
  }
});

test('the app’s covers are the web suite’s test covers', async () => {
  const fetch = createMockApiFetch(bundle);
  for (const url of [
    'https://covers.openlibrary.org/b/id/7892565-L.jpg',
    'https://covers.openlibrary.org/b/id/12645114-L.jpg',
    'https://covers.openlibrary.org/b/isbn/9780552166591-L.jpg?default=false',
    'https://covers.openlibrary.org/b/id/__expected-404-L.jpg',
    'https://covers.openlibrary.org/b/id/__expected-404-L.jpg?default=false',
  ]) {
    const web = coverResponse(url);
    const app = await fetch(url, { signal });
    assert.equal(app.status, web.status, url);
    assert.equal(app.headers.get('Content-Type'), web.contentType, url);
    assert.deepEqual(Buffer.from(await app.arrayBuffer()), Buffer.from(web.body), url);
  }
});
