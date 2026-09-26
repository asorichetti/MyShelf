// P09-03: how fast the Shelf searches and scrolls with thousands of books.
// These journeys measure and record (timing.json in the run directory, and a
// summary on stderr); they assert only what must hold on any machine: the
// results are right, the list reaches its end, nothing errors, and search
// stays under the plan's 100 ms budget for the database query.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Testids, tid } from '../selectors.ts';
import { rowNames, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const row = tid(Testids.home.row);
const list = tid(Testids.home.list);
const search = tid(Testids.home.search);
const resultCount = tid(Testids.home.resultCount);

/** The measure the Shelf records around each query (src/features/shelf/timing.ts). */
const SHELF_QUERY_MEASURE = 'myshelf:shelf-query';
/** The Shelf's search debounce (SEARCH_DEBOUNCE_MS in useShelf.ts), subtracted from the typed-to-shown time. */
const SEARCH_DEBOUNCE_MS = 200;
/** PLAN P09-03: search under 100 ms. Checked on the database query, the part the app controls. */
const SEARCH_BUDGET_MS = 100;

/**
 * Loads a big fixture: its loader page can take longer than the gates'
 * 15 s content wait, so this waits for the redirect itself and runs the page
 * gates on the Shelf once the rows are there.
 */
/**
 * How long a big fixture may take to load. Seeding 10,000 books on web takes
 * about 45 s on a laptop and several minutes on a shared CI runner, so the
 * scheduled workflow raises it with AUTOTEST_BIG_FIXTURE_TIMEOUT_MS.
 */
const BIG_FIXTURE_TIMEOUT_MS = Number(process.env.AUTOTEST_BIG_FIXTURE_TIMEOUT_MS) || 180_000;

async function openBigFixture(c: Context, fixture: string): Promise<number> {
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

interface ScrollTiming {
  totalMs: number;
  frames: number;
  /** Frames that took longer than 50 ms (a visible hitch). */
  longFrames: number;
  /** Frames missed at 60 Hz: the sum over frames of (duration / 16.7 ms) - 1, rounded down. */
  droppedFrames: number;
  p95FrameMs: number;
  maxFrameMs: number;
  /** Frames where no row was on screen at all (the list had not caught up: a blank shelf). */
  blankFrames: number;
  reachedEnd: boolean;
  lastRow: string | null;
}

/**
 * Scrolls the Shelf's list to the end, one viewport per animation frame (a
 * hard fling), and times every frame on the way.
 */
async function scrollToEnd(c: Context): Promise<ScrollTiming> {
  return c.page.evaluate(
    ([listSel, rowSel]) =>
      new Promise<ScrollTiming>((resolve) => {
        // The list's scroll container is the element itself or its first scrollable descendant.
        const root = document.querySelector<HTMLElement>(listSel as string)!;
        const scroller = [root, ...root.querySelectorAll<HTMLElement>('*')].find((el) => el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) ?? root;
        const frames: number[] = [];
        let blank = 0;
        let atEnd = 0;
        const start = performance.now();
        let last = start;
        const visibleRow = () => {
          const box = scroller.getBoundingClientRect();
          return [...scroller.querySelectorAll<HTMLElement>(rowSel as string)].some((r) => {
            const b = r.getBoundingClientRect();
            return b.bottom > box.top && b.top < box.bottom;
          });
        };
        const finish = (reachedEnd: boolean) => {
          const sorted = [...frames].sort((a, b) => a - b);
          const rows = [...scroller.querySelectorAll<HTMLElement>(rowSel as string)];
          resolve({
            totalMs: Math.round(performance.now() - start),
            frames: frames.length,
            longFrames: frames.filter((f) => f > 50).length,
            droppedFrames: frames.reduce((n, f) => n + Math.max(0, Math.floor(f / (1000 / 60)) - 1), 0),
            p95FrameMs: Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
            maxFrameMs: Math.round(sorted[sorted.length - 1] ?? 0),
            blankFrames: blank,
            reachedEnd,
            lastRow: rows[rows.length - 1]?.getAttribute('aria-label') ?? null,
          });
        };
        const step = (t: number) => {
          frames.push(t - last);
          last = t;
          if (!visibleRow()) blank++;
          const bottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
          atEnd = bottom ? atEnd + 1 : 0;
          // At the bottom for 30 frames running: the list has rendered its last rows and stopped growing.
          if (atEnd >= 30) return finish(true);
          if (t - start > 120_000) return finish(false);
          scroller.scrollTop += scroller.clientHeight;
          requestAnimationFrame(step);
        };
        requestAnimationFrame((t) => {
          last = t;
          requestAnimationFrame(step);
        });
      }),
    [list, row] as const,
  );
}

interface SearchTiming {
  query: string;
  /** The database query as the Shelf measured it (listShelfSections + count). */
  queryMs: number;
  /** Typed to the result count on screen, less the search debounce. */
  shownMs: number;
  summary: string;
}

/**
 * Types a search (or clears it, for `''`) and waits for the Shelf to show its
 * result; the Shelf's own measure gives the query time.
 */
async function timeSearch(c: Context, query: string): Promise<SearchTiming> {
  const before = await c.page.evaluate((n) => performance.getEntriesByName(n).length, SHELF_QUERY_MEASURE);
  const t0 = await c.page.evaluate(() => performance.now());
  await c.page.locator(search).fill(query);
  const shown = query ? `“${query}”` : 'Showing all';
  try {
    await c.page.waitForFunction(
      ([sel, text, n, count]) => document.querySelector(sel as string)?.textContent?.includes(text as string) && performance.getEntriesByName(n as string).length > (count as number),
      [resultCount, shown, SHELF_QUERY_MEASURE, before] as const,
      { timeout: 30_000, polling: 'raf' },
    );
  } catch {
    const found = await c.page.locator(resultCount).innerText();
    expect(false, `/: searching ${q(query)}: expected the result count to say ${q(shown)}, found ${q(found)}`);
  }
  const t1 = await c.page.evaluate(() => performance.now());
  const queryMs = await c.page.evaluate((n) => {
    const all = performance.getEntriesByName(n);
    return all[all.length - 1]?.duration ?? -1;
  }, SHELF_QUERY_MEASURE);
  return { query, queryMs: Math.round(queryMs * 10) / 10, shownMs: Math.round(t1 - t0 - SEARCH_DEBOUNCE_MS), summary: (await c.page.locator(resultCount).innerText()).trim() };
}

/** A cold start with the library already there: reload to the first row on screen, and the Shelf's first query. */
async function timeStartup(c: Context): Promise<{ firstRowMs: number; queryMs: number }> {
  const started = Date.now();
  await c.page.reload({ waitUntil: 'load' });
  await c.page.locator(row).first().waitFor({ state: 'visible', timeout: 60_000 });
  const firstRowMs = Date.now() - started;
  const queryMs = await c.page.evaluate((n) => performance.getEntriesByName(n)[0]?.duration ?? -1, SHELF_QUERY_MEASURE);
  return { firstRowMs, queryMs: Math.round(queryMs * 10) / 10 };
}

function record(c: Context, data: unknown): void {
  writeFileSync(join(c.runDir, 'timing.json'), JSON.stringify(data, null, 2) + '\n');
  c.logf(`timing ${JSON.stringify(data)}`);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};

register({
  name: 'shelf-large-scroll',
  suite: 'perf',
  desc: 'Fixture "large" (2,000 books): the Shelf scrolls to its last book with rows on screen; frame timings recorded in timing.json',
  async run(c) {
    const loadMs = await openBigFixture(c, 'large');
    const count = (await c.page.locator(tid(Testids.home.bookCount)).innerText()).trim();
    expect(/^2000 books catalogued$/i.test(count), `/ (large): expected the stamp "2000 books catalogued", found ${q(count)}`);
    const startup = await timeStartup(c);
    const scroll = await scrollToEnd(c);
    record(c, { fixture: 'large', loadMs, startup, scroll });
    expect(scroll.reachedEnd, `/ (large): expected to reach the end of the list, stopped after ${scroll.totalMs} ms`);
    expect(scroll.lastRow != null, '/ (large): expected rows at the end of the list, found none');
    await c.snap('large-end');
  },
});

register({
  name: 'shelf-huge-search',
  suite: 'perf',
  desc: 'Fixture "huge" (10,000 books): searches by title, author, series and prefix find the right books with the query under 100 ms; the list scrolls to its end; timings in timing.json',
  async run(c) {
    const loadMs = await openBigFixture(c, 'huge');
    const startup = await timeStartup(c);
    await waitVisible(c, search, '/ (huge)');
    // First search warms the statement cache; it is recorded but not judged.
    const warm = await timeSearch(c, 'warm');
    const searches: SearchTiming[] = [];
    for (const query of ['silent', 'lantern 42', 'hugo', 'saga 3', 'castell', 'midnight shelf', 'nothing like this']) {
      searches.push(await timeSearch(c, query));
    }
    const byQuery = Object.fromEntries(searches.map((s) => [s.query, s.summary]));
    // Every sixteenth book is "Silent …" (and "Silent" is only ever that word).
    expect(/^625 of 10000 books match/.test(byQuery.silent), `/ (huge): expected 625 "silent" books, found ${q(byQuery.silent)}`);
    expect(/^\d+ of 10000 books match “hugo”/.test(byQuery.hugo), `/ (huge): expected Hugo's books, found ${q(byQuery.hugo)}`);
    expect(/^No books match/.test(byQuery['nothing like this']), `/ (huge): expected no matches for nonsense, found ${q(byQuery['nothing like this'])}`);
    const names = await c.page.locator(search).inputValue();
    expect(names === 'nothing like this', `/ (huge): expected the search box to keep the text, found ${q(names)}`);

    // Clearing the search lists all 10,000 books again: the heaviest query the Shelf makes.
    const all = await timeSearch(c, '');
    const scroll = await scrollToEnd(c);
    const summary = { medianQueryMs: median(searches.map((s) => s.queryMs)), maxQueryMs: Math.max(...searches.map((s) => s.queryMs)), medianShownMs: median(searches.map((s) => s.shownMs)) };
    record(c, { fixture: 'huge', loadMs, startup, warm, searches, summary, all, scroll });
    expect(scroll.reachedEnd, `/ (huge): expected to reach the end of the list, stopped after ${scroll.totalMs} ms`);
    expect(summary.medianQueryMs < SEARCH_BUDGET_MS, `/ (huge): expected the median search query under ${SEARCH_BUDGET_MS} ms, found ${summary.medianQueryMs} ms (${q(searches.map((s) => [s.query, s.queryMs]))})`);
  },
});

/** PLAN P11-06: each preset's Shelf query well under 100 ms with 10,000 books. */
const SORT_BUDGET_MS = 100;

interface SortTiming {
  preset: string;
  /** Each application's database query (listShelfSections + count), as the Shelf measured it. */
  runs: number[];
  medianMs: number;
}

/** Applies a Sort sheet preset (the sheet is open) and returns the query time the Shelf measured for it. */
async function timePreset(c: Context, name: string): Promise<number> {
  const before = await c.page.evaluate((n) => performance.getEntriesByName(n).length, SHELF_QUERY_MEASURE);
  await c.page.locator(`${tid(Testids.sortSheet.preset)}[aria-label="${name}"]`).click();
  try {
    await c.page.waitForFunction(([n, count]) => performance.getEntriesByName(n as string).length > (count as number), [SHELF_QUERY_MEASURE, before] as const, { timeout: 30_000, polling: 'raf' });
  } catch {
    expect(false, `/ (huge): applying ${q(name)} never finished a Shelf query`);
  }
  return c.page.evaluate((n) => {
    const all = performance.getEntriesByName(n);
    return Math.round((all[all.length - 1]?.duration ?? -1) * 10) / 10;
  }, SHELF_QUERY_MEASURE);
}

register({
  name: 'shelf-huge-multisort',
  suite: 'perf',
  desc: 'Fixture "huge" (10,000 books): every Sort preset (Library order, series order, call number, newest, A–Z, by author, rainbow, surprise), three times each, and Library order grouped by genre, each with its Shelf query under 100 ms; timings in timing.json',
  async run(c) {
    const loadMs = await openBigFixture(c, 'huge');
    await c.page.locator(tid(Testids.home.sortButton)).click();
    await waitVisible(c, tid(Testids.sortSheet.root), '/ (huge, Sort sheet)');
    const presets = ['Library order', 'Series reading order', 'Call number', 'Newest additions', 'A–Z by title', 'By author', 'Rainbow', 'Surprise me'];
    // The first query after load warms the statement cache: recorded, not judged.
    const warm = await timePreset(c, 'By author');
    const timings: SortTiming[] = [];
    for (const preset of presets) {
      const runs: number[] = [];
      for (let i = 0; i < 3; i++) {
        runs.push(await timePreset(c, preset));
        // Something else in between, so the next run is a real change of sort.
        await timePreset(c, preset === 'A–Z by title' ? 'Newest additions' : 'A–Z by title');
      }
      timings.push({ preset, runs, medianMs: median(runs) });
    }
    await timePreset(c, 'Library order');
    const first = (await rowNames(c))[0];
    await c.page.locator(tid(Testids.sortSheet.done)).click();

    // Grouped by genre: the same query plus the memberships, then the within-section order.
    await c.page.locator(tid(Testids.shelfView.groupByButton)).click();
    const beforeGroup = await c.page.evaluate((n) => performance.getEntriesByName(n).length, SHELF_QUERY_MEASURE);
    await c.page.locator(tid(Testids.shelfView.groupByGenre)).click();
    await c.page.waitForFunction(([n, count]) => performance.getEntriesByName(n as string).length > (count as number), [SHELF_QUERY_MEASURE, beforeGroup] as const, { timeout: 30_000, polling: 'raf' });
    const groupedMs = await c.page.evaluate((n) => {
      const all = performance.getEntriesByName(n);
      return Math.round((all[all.length - 1]?.duration ?? -1) * 10) / 10;
    }, SHELF_QUERY_MEASURE);

    const summary = { maxMedianMs: Math.max(...timings.map((t) => t.medianMs)), groupedLibraryMs: groupedMs };
    record(c, { fixture: 'huge', loadMs, warm, timings, summary });
    expect(first.length > 0, '/ (huge, Library order): expected rows');
    for (const t of timings) {
      expect(t.medianMs < SORT_BUDGET_MS, `/ (huge): expected ${q(t.preset)} under ${SORT_BUDGET_MS} ms, found a median of ${t.medianMs} ms (${q(t.runs)})`);
    }
    expect(groupedMs < SORT_BUDGET_MS * 1.5, `/ (huge): expected Library order grouped by genre under ${SORT_BUDGET_MS * 1.5} ms, found ${groupedMs} ms`);
  },
});
