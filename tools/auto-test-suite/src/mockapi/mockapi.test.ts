import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { canonicalUrl, classify, DefaultMockDir, loadMockIndex, matchRoute, resolveMockApiFlag } from './index.ts';

function fixtureDir(routes: unknown, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'mockapi-'));
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ routes }));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

const OL = 'https://openlibrary.org';

test('the default index loads: every body file exists and parses', () => {
  const index = loadMockIndex(DefaultMockDir);
  assert.ok(index.routes.length > 40, `expected the recorded fixtures, got ${index.routes.length}`);
  const hit = matchRoute(index, `${OL}/isbn/9780552166591.json`);
  assert.equal(hit?.status, 200);
  assert.equal(hit?.contentType, 'application/json');
  assert.equal(JSON.parse(hit!.body.toString('utf8')).title, 'The Colour of Magic');
  const missing = matchRoute(index, `${OL}/isbn/9791099999993.json`);
  assert.equal(missing?.status, 404);
  assert.equal(missing?.expected, true);
  assert.match(missing!.contentType, /text\/html/);
});

test('--mock-api off disables mocking; empty means the default directory', () => {
  assert.equal(resolveMockApiFlag('off'), null);
  assert.equal(resolveMockApiFlag('OFF'), null);
  assert.equal(resolveMockApiFlag('')?.dir, DefaultMockDir);
});

test('URLs match exactly, whatever the order or encoding of their query', () => {
  const dir = fixtureDir([{ url: `${OL}/search.json?q=dune%20frank&limit=10`, body: 'a.json' }], { 'a.json': '{"docs":[]}' });
  const index = loadMockIndex(dir);
  assert.ok(matchRoute(index, `${OL}/search.json?limit=10&q=dune%20frank`));
  assert.ok(matchRoute(index, `${OL}/search.json?q=dune+frank&limit=10`));
  assert.equal(matchRoute(index, `${OL}/search.json?q=dune&limit=10`), undefined);
  assert.equal(matchRoute(index, `${OL}/search.json?q=dune%20frank&limit=10&extra=1`), undefined);
  assert.equal(canonicalUrl('https://x.org/p?b=2&a=1'), 'https://x.org/p?a=1&b=2');
});

test('a pattern with * matches after the exact routes', () => {
  const dir = fixtureDir(
    [
      { url: `${OL}/authors/*.json`, body: 'any.json' },
      { url: `${OL}/authors/OL1A.json`, body: 'one.json' },
    ],
    { 'any.json': '{"name":"Anyone"}', 'one.json': '{"name":"One"}' },
  );
  const index = loadMockIndex(dir);
  assert.equal(JSON.parse(matchRoute(index, `${OL}/authors/OL1A.json`)!.body.toString()).name, 'One');
  assert.equal(JSON.parse(matchRoute(index, `${OL}/authors/OL2A.json`)!.body.toString()).name, 'Anyone');
  assert.equal(matchRoute(index, `${OL}/works/OL2W.json`), undefined);
});

test('the loader rejects what would make a journey lie', () => {
  const bad: [unknown, Record<string, string>, RegExp][] = [
    [[{ url: 'https://example.com/a.json', body: 'a.json' }], { 'a.json': '{}' }, /not a mocked host/],
    [[{ url: `${OL}/a.json`, status: 404, body: 'a.json' }], { 'a.json': '{}' }, /needs "expected": true/],
    [[{ url: `${OL}/a.json`, body: 'missing.json' }], {}, /does not exist/],
    [[{ url: `${OL}/a.json`, body: 'a.json' }], { 'a.json': '{not json' }, /not valid JSON/],
    [[{ url: `${OL}/a.json`, body: '../a.json' }], {}, /inside the fixture directory/],
    [[{ url: `${OL}/a.json`, bogus: 1 }], {}, /unknown field "bogus"/],
    [[{ url: `${OL}/a.json` }, { url: `${OL}/a.json` }], {}, /duplicate url/],
    [[{ url: 'http://openlibrary.org/a.json' }], {}, /https URL/],
    [[{ url: `${OL}/a.bin`, body: 'a.bin' }], { 'a.bin': 'x' }, /content type/],
  ];
  for (const [routes, files, message] of bad) {
    assert.throws(() => loadMockIndex(fixtureDir(routes, files)), message, JSON.stringify(routes));
  }
  assert.throws(() => loadMockIndex(mkdtempSync(join(tmpdir(), 'mockapi-empty-'))), /no index.json/);
});

test('an expected error fixture loads with its status', () => {
  const dir = fixtureDir([{ url: `${OL}/a.json`, status: 500, body: 'a.json', expected: true }], { 'a.json': '{"error":1}' });
  const [route] = loadMockIndex(dir).routes;
  assert.equal(route!.status, 500);
  assert.equal(route!.expected, true);
});

test('requests are classified against the origin under test', () => {
  const base = 'http://localhost:8087';
  assert.equal(classify('http://localhost:8087/_expo/static/js/web/entry.js', base), 'same-origin');
  assert.equal(classify('data:image/png;base64,AAAA', base), 'same-origin');
  assert.equal(classify('https://openlibrary.org/isbn/1.json', base), 'mocked-host');
  assert.equal(classify('https://www.googleapis.com/books/v1/volumes?q=x', base), 'mocked-host');
  assert.equal(classify('https://covers.openlibrary.org/b/id/1-L.jpg', base), 'covers');
  assert.equal(classify('https://books.google.com/books/content?id=x&img=1', base), 'covers');
  assert.equal(classify('https://fonts.gstatic.com/x.woff2', base), 'external');
  assert.equal(classify('http://localhost:8081/', base), 'external');
});
