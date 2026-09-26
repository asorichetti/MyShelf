// Small helpers shared by journeys.
import { Testids, tid } from '../selectors.ts';
import { expect, q, type Context } from './registry.ts';

/** Matches a computed font-family that fell back to the browser's default serif. */
export const serifRe = /^\s*"?(Times|serif|-webkit-standard)/i;

/** Whether s (with spaces removed) contains every sub. */
export function containsAll(s: string, ...subs: string[]): boolean {
  const compact = s.replaceAll(' ', '');
  return subs.every((sub) => compact.includes(sub));
}

/**
 * Loads an E2E fixture (`empty`, `demo`, `large`) through the app's /e2e route
 * and waits until it has redirected to `next`. The page gates run on the
 * landing screen.
 */
export async function openFixture(c: Context, fixture: string, next = '/'): Promise<void> {
  const path = `/e2e?fixture=${fixture}&next=${encodeURIComponent(next)}`;
  await c.goto(path);
  try {
    await c.page.waitForURL((u) => u.pathname === next, { timeout: 15_000 });
  } catch {
    expect(false, `${path}: expected to land on ${q(next)}, stayed on ${q(new URL(c.page.url()).pathname)}`);
  }
}

/** Waits until exactly `n` elements match `selector` (lists render in batches). */
export async function waitForCount(c: Context, selector: string, n: number, where: string): Promise<void> {
  try {
    await c.page.waitForFunction(([sel, want]) => document.querySelectorAll(sel as string).length === want, [selector, n] as const, {
      timeout: 10_000,
    });
  } catch {
    const found = await c.page.locator(selector).count();
    expect(false, `${where}: expected ${n} of ${selector}, found ${found}`);
  }
}

/** The accessible names of the Shelf's rows, top to bottom. */
export async function rowNames(c: Context): Promise<string[]> {
  return c.page.locator(tid(Testids.home.row)).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') || ''));
}

/** Waits for the element to be visible, failing with a readable message. */
export async function waitVisible(c: Context, selector: string, where: string): Promise<void> {
  try {
    await c.page.locator(selector).first().waitFor({ state: 'visible', timeout: 10_000 });
  } catch (err) {
    expect(false, `${where}: ${selector} never became visible: ${(err as Error).message.split('\n')[0]}`);
  }
}

/** Waits for the URL path to match, failing with a readable message. */
export async function waitForPath(c: Context, test: RegExp | string, where: string): Promise<string> {
  try {
    await c.page.waitForURL((u) => (typeof test === 'string' ? u.pathname === test : test.test(u.pathname)), { timeout: 10_000 });
  } catch {
    expect(false, `${where}: expected the URL path to match ${String(test)}, found ${q(new URL(c.page.url()).pathname)}`);
  }
  return new URL(c.page.url()).pathname;
}
