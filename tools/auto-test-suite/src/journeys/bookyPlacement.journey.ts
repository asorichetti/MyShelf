// Phase 07 (P07-07): Booky's bubble never covers the Shelf's Add book button,
// the selection bar or the snackbar, and it stays hidden while a sheet or
// dialog is open. Checked by measuring boxes, at the mobile and tablet
// viewports, with screenshots for review.
import { Testids, tid } from '../selectors.ts';
import { openFixture, waitForCount, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const host = tid(Testids.booky.tipHost);
const bubble = tid(Testids.booky.bubble);
const helpButton = `${tid(Testids.booky.helpButton)} >> visible=true`;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxOf(c: Context, selector: string, where: string): Promise<Box> {
  const box = await c.page.locator(selector).first().boundingBox();
  expect(box != null, `${where}: ${selector} has no box (not rendered?)`);
  return box;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Asks for the Shelf's help, then checks the bubble is clear of every obstacle and inside the window. */
async function helpClearOf(c: Context, where: string, obstacles: Record<string, string>): Promise<void> {
  if ((await c.page.locator(bubble).count()) === 0) await c.page.locator(helpButton).first().click();
  await waitVisible(c, bubble, where);
  // Let the bubble measure itself and settle where it belongs.
  await c.settle();
  await c.page.waitForTimeout(200);
  const b = await boxOf(c, host, where);
  const viewport = c.page.viewportSize()!;
  expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1, `${where}: expected the bubble inside the window, found ${q(b)}`);
  for (const [name, selector] of Object.entries(obstacles)) {
    const o = await boxOf(c, selector, where);
    expect(!overlaps(b, o), `${where}: Booky's bubble ${q(b)} covers the ${name} ${q(o)}`);
  }
}

register({
  name: 'booky-placement',
  suite: 'p07',
  desc: 'Fixture "demo": Booky’s help bubble clears the Add book button (lifted on a phone, beside it on a tablet), the selection bar and the Undo snackbar, hides while the filter sheet is open and comes back after',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, tid(Testids.home.row), 12, '/');
    const fab = tid(Testids.home.addButton);

    await helpClearOf(c, '/ (mobile)', { 'Add book button': fab });
    await c.checkGates('/ (help open, mobile)');
    await c.snap('placement-fab-mobile');

    await c.page.setViewportSize({ width: 820, height: 1180 });
    await c.settle();
    await helpClearOf(c, '/ (tablet)', { 'Add book button': fab });
    const b = await boxOf(c, host, '/ (tablet)');
    const f = await boxOf(c, fab, '/ (tablet)');
    expect(b.y + b.height > f.y, `/ (tablet): expected the bubble to step beside the button rather than above it, found bubble ${q(b)} and button ${q(f)}`);
    await c.snap('placement-fab-tablet');
    await c.page.setViewportSize(c.viewport);
    await c.settle();

    // A sheet hides the tip; it comes back when the sheet closes. (Keyboard, so no tap dismisses the tip.)
    await helpClearOf(c, '/ (before the sheet)', { 'Add book button': fab });
    await c.page.locator(tid(Testids.shelfView.filterButton)).focus();
    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.shelfView.filterSheet), '/ filter sheet');
    await c.page.waitForTimeout(200);
    expect((await c.page.locator(bubble).count()) === 0, '/ (filter sheet open): expected Booky’s bubble hidden while a sheet is open');
    await c.snap('placement-sheet-open');
    await c.page.keyboard.press('Escape');
    await c.page.locator(tid(Testids.shelfView.filterSheet)).waitFor({ state: 'detached' });
    await waitVisible(c, bubble, '/ (filter sheet closed)');

    // The selection bar.
    await c.page.locator(tid(Testids.booky.dismiss)).click();
    await c.page.locator(tid(Testids.shelfView.selectButton)).click();
    await waitVisible(c, tid(Testids.selection.bar), '/ selecting');
    await c.page.locator(`${tid(Testids.home.row)}[aria-label^="Dune,"]`).click();
    await helpClearOf(c, '/ (selecting)', { 'selection bar': tid(Testids.selection.bar) });
    await c.snap('placement-selection-bar');

    // The Undo snackbar after removing a book.
    await c.page.locator(tid(Testids.booky.dismiss)).click();
    await c.page.locator(tid(Testids.selection.delete)).click();
    await waitVisible(c, tid(Testids.dialog.root), '/ confirm remove');
    await c.page.locator(tid(Testids.dialog.confirm)).click();
    await waitVisible(c, tid(Testids.snackbar.root), '/ undo snackbar');
    await helpClearOf(c, '/ (snackbar)', { snackbar: tid(Testids.snackbar.root), 'Add book button': fab });
    await c.checkGates('/ (help open over snackbar)');
    await c.snap('placement-snackbar');
  },
});
