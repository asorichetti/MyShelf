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
 * landing screen. `today` (YYYY-MM-DD) freezes the app's clock, so loan
 * dates in the fixture are fixed.
 */
export async function openFixture(c: Context, fixture: string, next = '/', today?: string): Promise<void> {
  const path = `/e2e?fixture=${fixture}${today ? `&today=${today}` : ''}&next=${encodeURIComponent(next)}`;
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

export interface CoverState {
  /** Real cover images present. */
  images: number;
  /** Of those, how many finished loading with pixels (naturalWidth > 0). */
  loaded: number;
  /** Natural size and CSS object-fit of the first image. */
  natural: { width: number; height: number; fit: string } | null;
  /** Generated fallback covers present. */
  fallbacks: number;
}

/**
 * Waits for the real cover images inside `scope` to finish loading, then
 * reports what is shown: real images (and how many rendered pixels) and
 * generated fallbacks. Images are lazy, so `scope` is scrolled into view.
 */
export async function coverState(c: Context, scope: string): Promise<CoverState> {
  const el = c.page.locator(scope).first();
  await el.scrollIntoViewIfNeeded();
  const image = `${tid(Testids.cover.image)} img`;
  await c.page
    .waitForFunction(
      // Loaded, and faded in (the app cross-fades a cover over its placeholder).
      ([s, img]) =>
        [...(document.querySelector(s as string)?.querySelectorAll<HTMLImageElement>(img as string) ?? [])].every(
          (i) => i.complete && (i.naturalWidth === 0 || getComputedStyle(i).opacity === '1'),
        ),
      [scope, image] as const,
      { timeout: 10_000 },
    )
    .catch(() => {});
  return el.evaluate(
    (root, [img, fallback]) => {
      const imgs = [...root.querySelectorAll<HTMLImageElement>(img!)];
      const first = imgs[0];
      return {
        images: imgs.length,
        loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
        natural: first ? { width: first.naturalWidth, height: first.naturalHeight, fit: getComputedStyle(first).objectFit } : null,
        fallbacks: root.querySelectorAll(fallback!).length,
      };
    },
    [image, tid(Testids.cover.fallback)],
  );
}
