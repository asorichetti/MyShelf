// The Playwright side of API mocking: one route handler per browser context,
// registered before the page opens, so it sees the first request of every
// command and journey. Requests to the mocked hosts are fulfilled from the
// index; covers fall through to the generated test JPEGs; anything else that
// leaves the tested origin is aborted and remembered, so the network gate can
// report it as `unmocked`.
import { classify, matchRoute, type MockIndex } from './index.ts';
import { COVERS_URL_PATTERN, coverResponse } from '../browser/covers.ts';

import type { BrowserContext, Route } from 'playwright';

/** What a context's mock handler did, for the network and console gates. */
export interface MockState {
  /** URLs answered with a fixture marked `expected` (deliberate 404/500). */
  expected: Set<string>;
  /** URLs aborted because nothing in the index answers them. */
  unmocked: Set<string>;
  /** Mocked hosts a `live` journey sends to the real network instead (see `sendToRealNetwork`). */
  realHosts: Set<string>;
}

const states = new WeakMap<BrowserContext, MockState>();

/** The mock state of a context (empty when mocking is off). */
export function mockStateFor(ctx: BrowserContext): MockState {
  let s = states.get(ctx);
  if (!s) {
    s = { expected: new Set(), unmocked: new Set(), realHosts: new Set() };
    states.set(ctx, s);
  }
  return s;
}

/**
 * For `live` journeys: requests to these mocked hosts (e.g. `openlibrary.org`)
 * go to the real network in this context from now on; other hosts stay
 * mocked, so a live journey is not at the mercy of keyless Google Books.
 * Combine with `unroute(COVERS_URL_PATTERN)` for real covers.
 */
export function sendToRealNetwork(ctx: BrowserContext, hosts: readonly string[]): void {
  for (const h of hosts) mockStateFor(ctx).realHosts.add(h);
}

/** The mock configuration the CLI resolved from --mock-api (null: off). */
let active: { index: MockIndex; baseOrigin: string } | null = null;

/** Sets the index and the origin under test for every page opened afterwards; null turns mocking off. */
export function setMockApi(index: MockIndex | null, baseURL = ''): void {
  active = index ? { index, baseOrigin: baseURL ? new URL(baseURL).origin : '' } : null;
}

/** The current configuration, for Browser.newPage. */
export function activeMockApi(): { index: MockIndex; baseOrigin: string } | null {
  return active;
}

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' };

/** Google Books thumbnails in lookup results, answered like covers. */
export const GOOGLE_THUMBNAILS_PATTERN = 'https://books.google.com/**';

/**
 * Routes every request that leaves `baseOrigin` in `ctx`: mocked hosts from
 * the index, anything else aborted as unmocked, and the cover hosts from the
 * index or the test JPEGs. Covers get their own routes on the usual pattern
 * (`COVERS_URL_PATTERN`), so a journey that wants the real ones (the `live`
 * suite) can `unroute` them as before. Same-origin requests are never
 * intercepted.
 */
export async function installMockApi(ctx: BrowserContext, index: MockIndex, baseOrigin: string): Promise<void> {
  const state = mockStateFor(ctx);
  const corsPreflight = async (route: Route) =>
    route.fulfill({ status: 204, headers: { ...corsHeaders, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, HEAD' } });

  const api = async (route: Route) => {
    const req = route.request();
    const url = req.url();
    if (state.realHosts.has(new URL(url).host)) return route.fallback();
    if (req.method() === 'OPTIONS') return corsPreflight(route);
    const hit = classify(url, baseOrigin) === 'mocked-host' ? matchRoute(index, url) : undefined;
    if (hit) {
      if (hit.expected) state.expected.add(url);
      await route.fulfill({ status: hit.status, contentType: hit.contentType, body: hit.body, headers: corsHeaders });
      return;
    }
    state.unmocked.add(url);
    await route.abort('blockedbyclient');
  };

  const covers = async (route: Route) => {
    const url = route.request().url();
    if (route.request().method() === 'OPTIONS') return corsPreflight(route);
    const hit = matchRoute(index, url);
    if (hit?.expected) state.expected.add(url);
    const r = hit ? { status: hit.status, contentType: hit.contentType, body: hit.body } : coverResponse(url);
    await route.fulfill({ status: r.status, contentType: r.contentType, body: r.body, headers: corsHeaders });
  };

  // A predicate rather than a glob, so same-origin traffic (the bundle, assets) is never intercepted.
  await ctx.route((u) => {
    const kind = classify(u.href, baseOrigin);
    return kind === 'mocked-host' || kind === 'external';
  }, api);
  await ctx.route(COVERS_URL_PATTERN, covers);
  await ctx.route(GOOGLE_THUMBNAILS_PATTERN, covers);
}
