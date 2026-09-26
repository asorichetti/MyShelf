// The `live` suite: journeys that use the real internet, so they show what a
// user sees rather than the offline stand-ins. They are left out of the
// per-push CI run (an outside service must not fail a commit) and run in the
// weekly live workflow and on demand:
//   npm run -s autotest -- journey --suite live --ux-gates fail
import { COVERS_URL_PATTERN } from '../browser/covers.ts';
import { Testids, tid } from '../selectors.ts';
import { coverState, openFixture, waitForCount, waitForPath, waitVisible } from './helpers.ts';
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
