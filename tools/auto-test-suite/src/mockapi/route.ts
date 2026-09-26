// The Playwright side of API mocking: one route handler per browser context,
// registered before the page opens, so it sees the first request of every
// command and journey. Requests to the mocked hosts are fulfilled from the
// index; covers fall through to the generated test JPEGs; anything else that
// leaves the tested origin is aborted and remembered, so the network gate can
// report it as `unmocked`.
import { classify, matchRoute, type MockIndex } from './index.ts';
import { coverResponse } from '../browser/covers.ts';

import type { BrowserContext, Route } from 'playwright';

/** What a context's mock handler did, for the network and console gates. */
export interface MockState {
  /** URLs answered with a fixture marked `expected` (deliberate 404/500). */
  expected: Set<string>;
  /** URLs aborted because nothing in the index answers them. */
  unmocked: Set<string>;
}

const states = new WeakMap<BrowserContext, MockState>();

/** The mock state of a context (empty when mocking is off). */
export function mockStateFor(ctx: BrowserContext): MockState {
  let s = states.get(ctx);
  if (!s) {
    s = { expected: new Set(), unmocked: new Set() };
    states.set(ctx, s);
  }
  return s;
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

/**
 * Routes every request that leaves `baseOrigin` in `ctx`: mocked hosts from
 * the index, covers from the index or the test JPEGs, and everything else
 * aborted as unmocked. Same-origin requests are never intercepted.
 */
export async function installMockApi(ctx: BrowserContext, index: MockIndex, baseOrigin: string): Promise<void> {
  const state = mockStateFor(ctx);
  const handler = async (route: Route) => {
    const req = route.request();
    const url = req.url();
    const kind = classify(url, baseOrigin);
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { ...corsHeaders, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, HEAD' } });
      return;
    }
    const hit = kind === 'mocked-host' || kind === 'covers' ? matchRoute(index, url) : undefined;
    if (hit) {
      if (hit.expected) state.expected.add(url);
      await route.fulfill({ status: hit.status, contentType: hit.contentType, body: hit.body, headers: corsHeaders });
      return;
    }
    if (kind === 'covers') {
      const r = coverResponse(url);
      await route.fulfill({ status: r.status, contentType: r.contentType, body: r.body, headers: corsHeaders });
      return;
    }
    state.unmocked.add(url);
    await route.abort('blockedbyclient');
  };
  // A predicate rather than a glob, so same-origin traffic (the bundle, assets) is never intercepted.
  await ctx.route((u) => classify(u.href, baseOrigin) !== 'same-origin', handler);
}
