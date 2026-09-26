// The `live` suite: journeys that use the real internet, so they show what a
// user sees rather than the offline stand-ins. They are left out of the
// per-push CI run (an outside service must not fail a commit) and run in the
// weekly live workflow and on demand:
//   npm run -s autotest -- journey --suite live --ux-gates fail
import { COVERS_URL_PATTERN } from '../browser/covers.ts';
import { sendToRealNetwork } from '../mockapi/route.ts';
import { Testids, tid } from '../selectors.ts';
import { coverState, GOODREADS_CSV, openFixture, upload, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const row = tid(Testids.home.row);
const d = Testids.bookDetail;

/**
 * Real Open Library covers are portrait scans around 300x500; the offline
 * stand-ins are at most 300px tall. A cover this tall is a real one.
 */
const REAL_MIN_HEIGHT = 400;

/** Demo books that deliberately have no cover (one missing, one broken URL). */
const NO_COVER = ['The Farthest Shore', 'The Murder of Roger Ackroyd'];

/** Stops answering covers.openlibrary.org with stand-ins for this journey's page. */
async function loadRealCovers(c: Context): Promise<void> {
  await c.page.context().unroute(COVERS_URL_PATTERN);
}

async function openRow(c: Context, title: string): Promise<string> {
  await c.page.locator(`${row}[aria-label^="${title},"]`).click();
  const path = await waitForPath(c, /^\/book\/\d+$/, `/ -> ${title}`);
  await waitVisible(c, tid(d.title), path);
  return path;
}

async function backToShelf(c: Context, from: string): Promise<void> {
  await c.page.locator(tid(d.back)).click();
  await waitForPath(c, '/', `${from} -> back`);
}

register({
  name: 'live-covers-detail',
  suite: 'live',
  desc: 'Real covers from covers.openlibrary.org on book detail: Good Omens, Dune, The Colour of Magic and Pride and Prejudice each show a real portrait cover, not a stand-in or the generated fallback',
  async run(c) {
    await loadRealCovers(c);
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');

    for (const title of ['Good Omens', 'Dune', 'The Colour of Magic', 'Pride and Prejudice']) {
      const path = await openRow(c, title);
      const cover = await coverState(c, tid(d.root));
      expect(cover.images === 1 && cover.loaded === 1, `${path} (${title}): expected the real cover to load, found ${q(cover)}`);
      expect(cover.fallbacks === 0, `${path} (${title}): expected no generated cover, found ${cover.fallbacks}`);
      expect(
        (cover.natural?.height ?? 0) >= REAL_MIN_HEIGHT && (cover.natural?.height ?? 0) > (cover.natural?.width ?? 0),
        `${path} (${title}): expected a real portrait cover at least ${REAL_MIN_HEIGHT}px tall, found ${q(cover.natural)}`,
      );
      await c.checkGates(`${path} (${title})`);
      await c.snap(`detail-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`);
      await backToShelf(c, path);
    }
  },
});

register({
  name: 'live-covers-shelf',
  suite: 'live',
  desc: 'Real covers on the Shelf, list and covers grid: every demo book with a cover shows a real one; only the two deliberately cover-less books show the generated cover',
  async run(c) {
    await loadRealCovers(c);
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');

    // List view: each row's thumbnail.
    const listed = await c.page.locator(row).evaluateAll(
      (rows, [img, fallback]) =>
        rows.map((r) => ({
          label: r.getAttribute('aria-label') ?? '',
          hasImage: !!r.querySelector(img!),
          hasFallback: !!r.querySelector(fallback!),
        })),
      [`${tid(Testids.cover.image)} img`, tid(Testids.cover.fallback)],
    );
    for (const r of listed) {
      const title = r.label.split(',')[0];
      if (NO_COVER.includes(title)) continue;
      expect(r.hasImage && !r.hasFallback, `/ (list): expected ${q(title)} to show a real cover, found ${q(r)}`);
    }
    await c.snap('shelf-list');

    // Covers grid: scroll through so every cell loads, then count what rendered.
    await c.page.locator(tid(Testids.shelfView.modeCovers)).click();
    await waitForCount(c, tid(Testids.shelfView.coverCell), 12, '/ (covers grid)');
    // While real covers download, each cell shows the generated cover as a stand-in.
    await c.snap('shelf-covers-grid-loading');
    const seen = new Map<string, { height: number; fallback: boolean }>();
    for (let i = 0; i < 12; i++) {
      await c.page.waitForFunction(
        (img) => [...document.querySelectorAll<HTMLImageElement>(img)].every((i) => i.complete),
        `${tid(Testids.cover.image)} img`,
        { timeout: 20_000 },
      );
      const cells = await c.page.locator(tid(Testids.shelfView.coverCell)).evaluateAll(
        (els, [img, fallback]) =>
          els.map((e) => ({
            label: (e.getAttribute('aria-label') ?? e.textContent ?? '').trim(),
            height: e.querySelector<HTMLImageElement>(img!)?.naturalHeight ?? 0,
            fallback: !!e.querySelector(fallback!),
          })),
        [`${tid(Testids.cover.image)} img`, tid(Testids.cover.fallback)],
      );
      for (const cell of cells) seen.set(cell.label, { height: cell.height, fallback: cell.fallback });
      if (seen.size >= 12) break;
      await c.page.mouse.wheel(0, 500);
    }
    const real = [...seen].filter(([, s]) => !s.fallback && s.height >= REAL_MIN_HEIGHT);
    const fallbacks = [...seen].filter(([, s]) => s.fallback).map(([label]) => label);
    c.logf(`covers grid: ${seen.size} cells, ${real.length} real covers, fallbacks: ${fallbacks.join(' | ')}`);
    expect(seen.size === 12, `/ (covers grid): expected to see all 12 books, saw ${seen.size}: ${q([...seen.keys()])}`);
    expect(real.length === 10, `/ (covers grid): expected 10 real covers (all but the two cover-less books), found ${real.length}: ${q([...seen])}`);
    expect(
      fallbacks.length === 2 && NO_COVER.every((t) => fallbacks.some((f) => f.includes(t))),
      `/ (covers grid): expected only ${q(NO_COVER)} to use the generated cover, found ${q(fallbacks)}`,
    );
    // Back at the top, wait for the covers to finish fading in over their stand-ins.
    await c.page.mouse.wheel(0, -5000);
    await c.page.waitForFunction(
      ([cell, ph]) => [...document.querySelectorAll(cell)].slice(0, 6).every((e) => !e.querySelector(ph)),
      [tid(Testids.shelfView.coverCell), tid(Testids.cover.placeholder)],
      { timeout: 20_000 },
    );
    await c.snap('shelf-covers-grid');
    await c.checkGates('/ (covers grid)');
  },
});

register({
  name: 'live-lookup-isbn-cover',
  suite: 'live',
  desc: 'Real Open Library and real covers: look up ISBN 9780552166591 on the add form -> the candidate shows a real cover -> save -> the book page shows a real portrait cover, not the generated one',
  async run(c) {
    await loadRealCovers(c);
    // Open Library for real; keyless Google Books is quota-blocked, so it keeps its recorded answer.
    sendToRealNetwork(c.page.context(), ['openlibrary.org']);
    await openFixture(c, 'empty', '/book/new');
    const l = Testids.lookup;
    await waitVisible(c, tid(l.isbnInput), '/book/new');
    await c.page.locator(tid(l.isbnInput)).fill('9780552166591');
    await c.page.locator(tid(l.isbnSubmit)).click();
    await waitVisible(c, tid(l.candidate), '/book/new (live lookup)');
    const label = (await c.page.locator(tid(l.candidate)).first().getAttribute('aria-label')) ?? '';
    expect(label.startsWith('The Colour of Magic, by Terry Pratchett'), `/book/new: expected The Colour of Magic, found ${q(label)}`);
    await c.page.locator(tid(l.candidate)).first().click();
    await c.page.locator(tid(Testids.bookForm.save)).click();
    const path = await waitForPath(c, /^\/book\/\d+$/, '/book/new -> save');
    await waitVisible(c, tid(d.title), path);
    // The cover chain stores the best real cover after the save; wait for a real scan to render.
    await c.page
      .waitForFunction(
        ([scope, img, min]) => [...(document.querySelector(scope as string)?.querySelectorAll<HTMLImageElement>(img as string) ?? [])].some((i) => i.complete && i.naturalHeight >= (min as number)),
        [tid(d.root), `${tid(Testids.cover.image)} img`, REAL_MIN_HEIGHT] as const,
        { timeout: 30_000 },
      )
      .catch(() => {});
    const state = await coverState(c, tid(d.root));
    expect(
      state.loaded >= 1 && state.fallbacks === 0 && (state.natural?.height ?? 0) >= REAL_MIN_HEIGHT,
      `${path}: expected a real portrait cover (>= ${REAL_MIN_HEIGHT}px tall) and no generated cover, found ${q(state)}`,
    );
    await c.snap('live-lookup-saved');
    await c.checkGates(`${path} (live cover)`);
  },
});

/** Every book in the Goodreads export fixture, by the title the Shelf shows. */
const GOODREADS_TITLES = [
  'Good Omens',
  'The Hobbit',
  '1984',
  'The Name of the Wind',
  'The Final Empire',
  'Project Hail Mary',
  'Circe',
  'The Thursday Murder Club',
  'Leviathan Wakes',
  'The Left Hand of Darkness',
  'Norse Mythology',
  '"Surely You\'re Joking, Mr. Feynman!"',
  'The Science of Discworld',
  'Les Misérables',
  'Dune',
  'The Martian',
  'The Fellowship of the Ring',
  'Pride and Prejudice',
  'The Colour of Magic',
  "Harry Potter and the Philosopher's Stone",
];

/**
 * Imported books Open Library has no cover for, with the reason; only these
 * may keep the generated cover. Empty: checked against the live APIs in
 * September 2026, Open Library has a cover of at least 400 px for all 20
 * (the one without an ISBN, The Colour of Magic, through its title and
 * author search).
 */
const GOODREADS_WITHOUT_OL_COVER: Record<string, string> = {};

/** How long the whole import may take to show its covers. Measured at about 13 s for the 20 books. */
const COVERS_SETTLE_MS = 90_000;

interface CellCover {
  label: string;
  src: string | null;
  complete: boolean;
  height: number;
  fallback: boolean;
}

/** Every covers-grid cell as it is now: its label, its cover image (if any) and whether it shows the generated cover. */
async function gridCovers(c: Context): Promise<CellCover[]> {
  return c.page.locator(tid(Testids.shelfView.coverCell)).evaluateAll(
    (els, [img, fallback]) =>
      els.map((e) => {
        const i = e.querySelector<HTMLImageElement>(img!);
        return {
          label: (e.getAttribute('aria-label') ?? e.textContent ?? '').trim(),
          src: i?.getAttribute('src') ?? null,
          complete: !!i?.complete,
          height: i?.naturalHeight ?? 0,
          fallback: !!e.querySelector(fallback!),
        };
      }),
    [`${tid(Testids.cover.image)} img`, tid(Testids.cover.fallback)],
  );
}

register({
  name: 'live-goodreads-import-covers',
  suite: 'live',
  desc: 'Real Open Library and real covers: import the Goodreads export fixture (20 books) → the cover backfill (one batch search, then covers by id) settles with every imported book showing a real portrait cover at least 400 px tall; only books proven to have no Open Library cover may keep the generated one (none today)',
  async run(c) {
    await loadRealCovers(c);
    sendToRealNetwork(c.page.context(), ['openlibrary.org']);
    await openFixture(c, 'empty', '/settings');
    // Keyless Google Books is quota-blocked; Open Library alone finds these covers.
    await c.page.locator(tid(Testids.settings.googleBooksToggle)).click();
    await c.page.locator(tid(Testids.settings.importCsv)).click();
    await waitForPath(c, '/settings/import-csv', '/settings -> import');
    await upload(c, tid(Testids.csvImport.pick), GOODREADS_CSV, '/settings/import-csv');
    await waitVisible(c, tid(Testids.csvImport.confirm), '/settings/import-csv (preview)');
    await c.page.locator(tid(Testids.csvImport.confirm)).click();
    const started = Date.now();
    await waitVisible(c, tid(Testids.csvImport.report), '/settings/import-csv (report)');
    await c.page.locator(tid(Testids.csvImport.done)).click();
    await waitForPath(c, '/', '/settings/import-csv -> shelf');

    // The covers grid holds all 20 books at once (no scrolling), so one condition can watch every cover arrive.
    await c.page.locator(tid(Testids.shelfView.modeCovers)).click();
    await waitForCount(c, tid(Testids.shelfView.coverCell), GOODREADS_TITLES.length, '/ (covers grid)');
    const excluded = Object.keys(GOODREADS_WITHOUT_OL_COVER);
    const settled = await c.page
      .waitForFunction(
        ([cell, img, min, skip]) =>
          [...document.querySelectorAll(cell as string)].every((e) => {
            const label = e.getAttribute('aria-label') ?? e.textContent ?? '';
            if ((skip as string[]).some((t) => label.includes(t))) return true;
            const i = e.querySelector<HTMLImageElement>(img as string);
            return !!i && i.complete && i.naturalHeight >= (min as number);
          }),
        [tid(Testids.shelfView.coverCell), `${tid(Testids.cover.image)} img`, REAL_MIN_HEIGHT, excluded] as const,
        { timeout: COVERS_SETTLE_MS, polling: 250 },
      )
      .then(() => true)
      .catch(() => false);
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    const cells = await gridCovers(c);
    const real = cells.filter((x) => !x.fallback && x.complete && x.height >= REAL_MIN_HEIGHT);
    c.logf(`covers ${settled ? 'settled' : 'not settled'} ${elapsed}s after the import: ${real.length}/${cells.length} real covers`);

    expect(cells.length === GOODREADS_TITLES.length, `/ (covers grid): expected ${GOODREADS_TITLES.length} books, found ${cells.length}`);
    for (const title of GOODREADS_TITLES) {
      const cell = cells.find((x) => x.label.includes(title));
      expect(!!cell, `/ (covers grid): expected a cell for ${q(title)}, found ${q(cells.map((x) => x.label))}`);
      if (!cell) continue;
      if (GOODREADS_WITHOUT_OL_COVER[title]) {
        expect(cell.fallback, `/ (covers grid): ${q(title)} has no Open Library cover (${GOODREADS_WITHOUT_OL_COVER[title]}), so expected the generated cover, found ${q(cell)}`);
        continue;
      }
      expect(
        !cell.fallback && cell.complete && cell.height >= REAL_MIN_HEIGHT && /^https:\/\/covers\.openlibrary\.org\//.test(cell.src ?? ''),
        `/ (covers grid): expected ${q(title)} to show a real Open Library cover at least ${REAL_MIN_HEIGHT}px tall within ${COVERS_SETTLE_MS / 1000}s, found ${q(cell)}`,
      );
    }

    // Settled: wait for the covers to finish fading in over their placeholders, then look.
    await c.page
      .waitForFunction(([cell, ph]) => [...document.querySelectorAll(cell)].every((e) => !e.querySelector(ph)), [tid(Testids.shelfView.coverCell), tid(Testids.cover.placeholder)], {
        timeout: 20_000,
      })
      .catch(() => {});
    // Three screenshots cover the whole grid: the top rows, the middle and the end.
    await c.snap('live-import-covers-grid');
    await c.page.mouse.wheel(0, 900);
    await c.page.waitForTimeout(500);
    await c.snap('live-import-covers-grid-middle');
    await c.page.mouse.wheel(0, 5000);
    await c.page.waitForTimeout(500);
    await c.snap('live-import-covers-grid-end');
    await c.checkGates('/ (imported books with real covers)');

    // The list view shows the same covers (newest additions at the top).
    await c.page.locator(tid(Testids.shelfView.modeList)).click();
    const sel = `${row}[aria-label^="The Final Empire,"]`;
    await waitVisible(c, sel, '/ (list)');
    const cover = await coverState(c, sel);
    expect(
      cover.loaded === 1 && cover.fallbacks === 0 && (cover.natural?.height ?? 0) >= REAL_MIN_HEIGHT,
      `/ (list, The Final Empire): expected a real portrait cover (>= ${REAL_MIN_HEIGHT}px tall), found ${q(cover)}`,
    );
    await c.page.mouse.wheel(0, -5000);
    await c.snap('live-import-covers');
  },
});
