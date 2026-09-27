// The Android E2E build's copy of the recorded API responses (docs/device-testing.md):
// the same fixture index --mock-api serves on web, loaded and validated by the
// same code (index.ts), with the same test covers (browser/covers.ts),
// written as one JSON file the app bundles only in E2E builds
// (src/generated/e2eApiFixtures.json, read by src/features/e2e/mockApi.ts).
//
//   npm run e2eapi:gen     rewrite it after changing the fixtures
//   npm run e2eapi:check   fail if it is out of date (part of npm run check)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadMockIndex, type MockIndex } from './index.ts';
import { NO_COVER_GIF, PADDED_COVER_IDS } from '../browser/covers.ts';
import { ExpectedMissingMarker } from '../uxgates/expected.ts';

import type { MockApiBundle, MockApiRoute } from '../../../../src/features/e2e/mockApiFetch.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');

/** Where the app reads the bundle from. */
export const NativeBundlePath = join(repoRoot, 'src/generated/e2eApiFixtures.json');

/** A string only the bundle holds: grep a production bundle for it to prove the fixtures are not there. */
export const NativeBundleMarker = 'myshelf-e2e-api-fixtures-v1';

function isText(contentType: string): boolean {
  return /^(text\/|application\/json)/.test(contentType);
}

/** The bundle for an index: every route (JSON bodies minified, images as base64) and the test covers. */
export function buildNativeBundle(index: MockIndex): MockApiBundle {
  const routes = index.routes.map((r): MockApiRoute => {
    const route: MockApiRoute = { url: r.url, status: r.status, contentType: r.contentType };
    if (r.pattern) route.glob = true;
    if (r.expected) route.expected = true;
    if (!isText(r.contentType)) route.base64 = r.body.toString('base64');
    else if (r.contentType.startsWith('application/json') && r.body.length) route.text = JSON.stringify(JSON.parse(r.body.toString('utf8')));
    else route.text = r.body.toString('utf8');
    return route;
  });
  const fixtures = join(here, '../browser/fixtures');
  return {
    marker: NativeBundleMarker,
    routes,
    covers: {
      cover: readFileSync(join(fixtures, 'test-cover.jpg')).toString('base64'),
      padded: readFileSync(join(fixtures, 'test-cover-padded.jpg')).toString('base64'),
      noCover: NO_COVER_GIF.toString('base64'),
      paddedIds: [...PADDED_COVER_IDS],
      expectedMissingMarker: ExpectedMissingMarker,
    },
  };
}

/** The file's text: stable, one route per line so a fixture change is a readable diff. */
export function renderNativeBundle(bundle: MockApiBundle): string {
  const { routes, ...rest } = bundle;
  const head = JSON.stringify({ ...rest, routes: [] }, null, 2);
  const lines = routes.map((r) => `    ${JSON.stringify(r)}`).join(',\n');
  return `${head.replace('"routes": []', `"routes": [\n${lines}\n  ]`)}\n`;
}

/** Writes (or with `check`, compares) the bundle for a fixture directory; `ok` is false when the file is stale. */
export function generateNativeBundle(dir: string, { check = false } = {}): { ok: boolean; path: string; routes: number } {
  const text = renderNativeBundle(buildNativeBundle(loadMockIndex(dir)));
  const routes = (JSON.parse(text) as MockApiBundle).routes.length;
  let current = '';
  try {
    current = readFileSync(NativeBundlePath, 'utf8');
  } catch {
    // missing: stale
  }
  if (check) return { ok: current === text, path: NativeBundlePath, routes };
  if (current !== text) {
    mkdirSync(dirname(NativeBundlePath), { recursive: true });
    writeFileSync(NativeBundlePath, text);
  }
  return { ok: true, path: NativeBundlePath, routes };
}
