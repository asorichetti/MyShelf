// Small helpers shared by journeys.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Clicks `selector` and answers the browser's file chooser with `path`. */
export async function upload(c: Context, selector: string, path: string, where: string): Promise<void> {
  const chooser = c.page.waitForEvent('filechooser', { timeout: 10_000 });
  await c.page.locator(selector).click();
  try {
    await (await chooser).setFiles(path);
  } catch (err) {
    expect(false, `${where}: expected a file chooser after clicking ${selector}: ${(err as Error).message.split('\n')[0]}`);
  }
}

/** Backup and CSV files shared with the app's Jest tests. */
const BACKUP_FIXTURES = fileURLToPath(new URL('../../../../src/services/backup/__fixtures__/', import.meta.url));
/** A Goodreads "Export library" file: 20 books with Goodreads' real columns and quirks. */
export const GOODREADS_CSV = join(BACKUP_FIXTURES, 'goodreads_library_export.csv');
/** A backup from schema version 1 (three Earthsea books), to restore through the migrations. */
export const SCHEMA1_BACKUP = join(BACKUP_FIXTURES, 'backup-schema1.json');

/** A backup whose 20 books (the Goodreads export) had their covers stored on the phone, so they come back without covers. */
export const PHONE_COVERS_BACKUP = join(BACKUP_FIXTURES, 'backup-phone-covers.json');

/** One covers-grid cell as it is now. */
export interface GridCover {
  label: string;
  /** The cover image's `src`, or null when the cell shows no image. */
  src: string | null;
  /** Loaded, with its natural height (0 until loaded). */
  complete: boolean;
  height: number;
  /** Shows the generated cover. */
  fallback: boolean;
}

/** Every cell of the Shelf's covers grid, with its cover's state. */
export async function gridCovers(c: Context): Promise<GridCover[]> {
  return c.page.locator(tid(Testids.shelfView.coverCell)).evaluateAll(
    (els, [img, fallback]) =>
      els.map((e) => {
        const i = [...e.querySelectorAll<HTMLImageElement>(img!)].find((x) => x.complete && x.naturalWidth > 0) ?? e.querySelector<HTMLImageElement>(img!);
        return {
          label: (e.getAttribute('aria-label') ?? e.textContent ?? '').trim(),
          src: i?.getAttribute('src') ?? null,
          complete: !!i?.complete && (i?.naturalWidth ?? 0) > 0,
          height: i?.naturalHeight ?? 0,
          fallback: !!e.querySelector(fallback!),
        };
      }),
    [`${tid(Testids.cover.image)} img`, tid(Testids.cover.fallback)],
  );
}

/**
 * Switches the Shelf to the covers grid (it holds a small library at once,
 * with no scrolling) and waits until every cell shows a loaded cover at
 * least `minHeight` px tall, except cells whose label contains one of
 * `skip`, or until `timeout`. Resolves with whether that happened, the
 * seconds it took from `since` and every cell's state, for the caller to
 * assert on; then waits for the covers to finish fading in, so a
 * screenshot shows them.
 */
export async function waitForGridCovers(
  c: Context,
  { count, minHeight = 1, skip = [], timeout, since = Date.now() }: { count: number; minHeight?: number; skip?: readonly string[]; timeout: number; since?: number },
): Promise<{ settled: boolean; seconds: number; cells: GridCover[] }> {
  await c.page.locator(tid(Testids.shelfView.modeCovers)).click();
  await waitForCount(c, tid(Testids.shelfView.coverCell), count, '/ (covers grid)');
  const settled = await c.page
    .waitForFunction(
      ([cell, img, min, skipped]) =>
        [...document.querySelectorAll(cell as string)].every((e) => {
          const label = e.getAttribute('aria-label') ?? e.textContent ?? '';
          if ((skipped as string[]).some((t) => label.includes(t))) return true;
          return [...e.querySelectorAll<HTMLImageElement>(img as string)].some((i) => i.complete && i.naturalWidth > 0 && i.naturalHeight >= (min as number));
        }),
      [tid(Testids.shelfView.coverCell), `${tid(Testids.cover.image)} img`, minHeight, [...skip]] as const,
      { timeout, polling: 250 },
    )
    .then(() => true)
    .catch(() => false);
  const seconds = (Date.now() - since) / 1000;
  await c.page
    .waitForFunction(([cell, ph]) => [...document.querySelectorAll(cell)].every((e) => !e.querySelector(ph)), [tid(Testids.shelfView.coverCell), tid(Testids.cover.placeholder)] as const, {
      timeout: 10_000,
    })
    .catch(() => {});
  return { settled, seconds, cells: await gridCovers(c) };
}

/**
 * How long a big fixture (`large`, 2,000 books; `huge`, 10,000) may take to
 * load. Seeding 10,000 books on web takes about 45 s on a laptop and several
 * minutes on a shared CI runner, so the scheduled workflow raises it with
 * AUTOTEST_BIG_FIXTURE_TIMEOUT_MS.
 */
const BIG_FIXTURE_TIMEOUT_MS = Number(process.env.AUTOTEST_BIG_FIXTURE_TIMEOUT_MS) || 180_000;

/**
 * Loads a big fixture and returns how long it took. Its loader page can take
 * longer than the gates' 15 s content wait, so this waits for the redirect to
 * the Shelf itself and runs the page gates once the rows are there.
 */
export async function openBigFixture(c: Context, fixture: string): Promise<number> {
  const row = tid(Testids.home.row);
  const started = Date.now();
  await c.page.goto(c.url(`/e2e?fixture=${fixture}&next=${encodeURIComponent('/')}`), { waitUntil: 'load' });
  try {
    await c.page.waitForURL((u) => u.pathname === '/', { timeout: BIG_FIXTURE_TIMEOUT_MS });
    await c.page.locator(row).first().waitFor({ state: 'visible', timeout: 60_000 });
  } catch {
    expect(false, `/e2e?fixture=${fixture}: expected the Shelf with rows, stayed on ${q(new URL(c.page.url()).pathname)}`);
  }
  const loadMs = Date.now() - started;
  await c.checkGates('/ (' + fixture + ')');
  return loadMs;
}
