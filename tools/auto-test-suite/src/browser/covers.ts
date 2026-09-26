// Serves book covers without the internet. Fixture books point at real
// covers.openlibrary.org URLs (the app's golden path); every page the suite
// opens answers those requests with small synthetic JPEGs from ./fixtures,
// so journeys exercise the real-image path deterministically and offline.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isExpectedMissing } from '../uxgates/expected.ts';

import type { BrowserContext, Route } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));

/** The synthetic 2:3 test cover on disk (for a journey that picks a photo). */
export const TEST_COVER_PATH = join(here, 'fixtures', 'test-cover.jpg');

/** The covers host the app's fixtures use. */
export const COVERS_URL_PATTERN = 'https://covers.openlibrary.org/**';

/** Cover ids answered with the padded square scan (white bars left and right). */
export const PADDED_COVER_IDS = ['12645114'];

let images: { cover: Buffer; padded: Buffer } | undefined;
function load() {
  images ??= {
    cover: readFileSync(join(here, 'fixtures', 'test-cover.jpg')),
    padded: readFileSync(join(here, 'fixtures', 'test-cover-padded.jpg')),
  };
  return images;
}

/**
 * What a covers request gets: the padded scan for PADDED_COVER_IDS, a real
 * 404 for URLs carrying the expected-missing marker (the fixture's broken
 * cover), and the plain test cover for everything else.
 */
export function coverResponse(url: string): { status: number; body: Buffer | string; contentType: string } {
  if (isExpectedMissing(url)) return { status: 404, body: 'Not Found', contentType: 'text/plain' };
  const { cover, padded } = load();
  const id = /\/b\/id\/(\d+)-/.exec(url)?.[1];
  return { status: 200, body: id && PADDED_COVER_IDS.includes(id) ? padded : cover, contentType: 'image/jpeg' };
}

async function fulfil(route: Route): Promise<void> {
  const r = coverResponse(route.request().url());
  await route.fulfill({
    status: r.status,
    contentType: r.contentType,
    body: r.body,
    headers: { 'Cross-Origin-Resource-Policy': 'cross-origin', 'Access-Control-Allow-Origin': '*' },
  });
}

/** Routes every covers.openlibrary.org request in the context to the test covers. */
export async function routeCovers(ctx: BrowserContext): Promise<void> {
  await ctx.route(COVERS_URL_PATTERN, fulfil);
}
