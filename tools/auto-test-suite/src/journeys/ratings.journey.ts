// Phase 10: the reader's own star ratings. Rating from a book's page and the
// form, sorting and filtering the Shelf by rating, ratings coming in from a
// Goodreads export and surviving a backup, the keyboard contract of the
// stars, and the stars in the dark.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Testids, tid } from '../selectors.ts';
import { darkColors, lightColors } from '../themeTokens.ts';
import { GOODREADS_CSV, openFixture, rowNames, upload, waitForCount, waitForGridCovers, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const row = tid(Testids.home.row);
const r = Testids.rating;
const sv = Testids.shelfView;
const slider = tid(r.control);
const TODAY = '2026-06-20';

/** "#6B3FA8" → "rgb(107, 63, 168)", the way the browser reports a computed colour. */
function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

async function openRow(c: Context, title: string): Promise<string> {
  await c.page.locator(`${row}[aria-label^="${title},"]`).click();
  const path = await waitForPath(c, /^\/book\/\d+$/, `/ -> ${title}`);
  await waitVisible(c, slider, path);
  return path;
}

/**
 * The rating control on screen. A stack keeps the screens underneath mounted (a book's page under its edit
 * form), hidden, with their own stars: only the visible one counts.
 */
const control = (c: Context) => c.page.locator(slider).filter({ visible: true });

/** Clicks the nth star (1-5) of the rating control on screen. */
async function clickStar(c: Context, n: number): Promise<void> {
  await control(c).locator(tid(r.star)).nth(n - 1).click();
}

/** Waits until the rating control on screen says `want` ("4 out of 5 stars", "Not rated"). */
async function waitForValue(c: Context, want: string, where: string): Promise<void> {
  try {
    await c.page.waitForFunction(
      ([s, w]) =>
        [...document.querySelectorAll<HTMLElement>(s)].find((e) => e.offsetParent !== null && !e.closest('[aria-hidden="true"]'))?.getAttribute('aria-valuetext') === w,
      [slider, want] as const,
      { timeout: 10_000 },
    );
  } catch {
    expect(false, `${where}: expected the rating control to say ${q(want)}, found ${q(await control(c).first().getAttribute('aria-valuetext').catch(() => '(none visible)'))}`);
  }
}

/** Waits until the live status under the stars on screen says `want`. */
async function waitForStatus(c: Context, want: string, where: string): Promise<void> {
  try {
    await c.page.waitForFunction(
      ([s, w]) => [...document.querySelectorAll<HTMLElement>(s)].find((e) => e.offsetParent !== null && !e.closest('[aria-hidden="true"]'))?.innerText.trim() === w,
      [tid(r.status), want] as const,
      { timeout: 10_000 },
    );
  } catch {
    const found = await c.page.locator(tid(r.status)).filter({ visible: true }).first().innerText().catch(() => '(none visible)');
    expect(false, `${where}: expected the rating status ${q(want)}, found ${q(found)}`);
  }
}

/** Waits until the Shelf's row for `title` has exactly the accessible name `want`. */
async function waitForRow(c: Context, title: string, want: string, where: string): Promise<void> {
  try {
    await c.page.waitForFunction(
      ([sel, t, w]) => [...document.querySelectorAll(sel as string)].some((e) => (e.getAttribute('aria-label') ?? '').startsWith(`${t},`) && e.getAttribute('aria-label') === w),
      [row, title, want] as const,
      { timeout: 10_000 },
    );
  } catch {
    const names = (await rowNames(c)).filter((n) => n.startsWith(`${title},`));
    expect(false, `${where}: expected the row ${q(want)}, found ${q(names)}`);
  }
}

/** The data-testid (or tag) of the focused element. */
async function focused(c: Context): Promise<string> {
  return c.page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return '';
    return el.getAttribute('data-testid') || `${el.tagName}${el.getAttribute('aria-label') ? ` "${el.getAttribute('aria-label')}"` : ''}`;
  });
}

async function text(c: Context, selector: string): Promise<string> {
  return (await c.page.locator(selector).first().innerText()).replace(/\s+/g, ' ').trim();
}

async function waitForText(c: Context, selector: string, want: RegExp, where: string): Promise<string> {
  try {
    await c.page.waitForFunction(
      ([s, src, flags]) => new RegExp(src as string, flags as string).test(((document.querySelector(s as string) as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ')),
      [selector, want.source, want.flags] as const,
      { timeout: 15_000 },
    );
  } catch {
    const found = (await c.page.locator(selector).count()) ? await text(c, selector) : '(missing)';
    expect(false, `${where}: expected ${selector} to match ${String(want)}, found ${q(found)}`);
  }
  return text(c, selector);
}

/** Clicks `selector` and returns the downloaded file, saved into the run directory. */
async function download(c: Context, selector: string, where: string): Promise<{ name: string; path: string; text: string }> {
  const pending = c.page.waitForEvent('download', { timeout: 15_000 });
  await c.page.locator(selector).click();
  let file;
  try {
    file = await pending;
  } catch {
    expect(false, `${where}: expected a download after clicking ${selector}, none came`);
  }
  const path = join(c.runDir, file.suggestedFilename());
  await file.saveAs(path);
  return { name: file.suggestedFilename(), path, text: await readFile(path, 'utf8') };
}

/** Settings tab (through the tab bar), then one of its rows. */
async function openSetting(c: Context, rowId: string, to: string): Promise<void> {
  const at = new URL(c.page.url()).pathname;
  if (at.startsWith('/settings/')) {
    await c.page.getByRole('button', { name: 'Back to Settings' }).click();
    await waitForPath(c, '/settings', `${to}: back to Settings`);
  } else if (at !== '/settings') {
    await waitForCount(c, tid(Testids.tabs.settings), 1, `${to}: one tab bar`);
    await c.page.locator(tid(Testids.tabs.settings)).click();
    await waitForPath(c, '/settings', `${to}: Settings tab`);
  }
  await c.page.locator(tid(rowId)).click();
  await waitForPath(c, to, `/settings -> ${to}`);
}

async function openShelf(c: Context): Promise<void> {
  if (new URL(c.page.url()).pathname.startsWith('/settings/')) {
    await c.page.getByRole('button', { name: 'Back to Settings' }).click();
    await waitForPath(c, '/settings', 'back to Settings');
  }
  await waitForCount(c, tid(Testids.tabs.shelf), 1, 'one tab bar');
  await c.page.locator(tid(Testids.tabs.shelf)).click();
  await waitForPath(c, '/', 'Shelf tab');
}

/** Restores `file` with Replace (typed REPLACE) from Settings, then goes back to the Shelf. */
async function restore(c: Context, file: string, books: RegExp): Promise<void> {
  await openSetting(c, Testids.settings.importBackup, '/settings/restore');
  await upload(c, tid(Testids.restore.pick), file, '/settings/restore');
  await waitForText(c, tid(Testids.restore.file), books, '/settings/restore (file chosen)');
  await c.page.locator(tid(Testids.restore.confirmInput)).fill('REPLACE');
  await c.page.locator(tid(Testids.restore.confirm)).click();
  await waitForText(c, tid(Testids.restore.summary), /Library restored/, '/settings/restore');
  await openShelf(c);
}

/** Every Shelf row's rating: title → stars (null when not rated), from the rows' accessible names. */
async function ratingsOnShelf(c: Context): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  for (const n of await rowNames(c)) {
    const m = /, rated (\d) out of 5/.exec(n);
    out[n.split(', by ')[0]!.split(',')[0]!] = m ? Number(m[1]) : null;
  }
  return out;
}

register({
  name: 'rating-detail-persists',
  suite: 'p10',
  desc: 'Fixture "demo": an unrated book\'s page says "Not rated" → tap the 4th star → "Rated 4 stars" in a polite live region → the Shelf row reads the rating back ("…, rated 4 out of 5") → after a reload the page still shows 4 stars → a second tap on the 4th star clears it',
  async run(c) {
    await openFixture(c, 'demo', '/', TODAY);
    await waitForCount(c, row, 12, '/');
    const path = await openRow(c, 'The Light Fantastic');
    await waitForValue(c, 'Not rated', path);
    const attrs = await control(c).evaluate((el) => ({
      role: el.getAttribute('role'),
      name: el.getAttribute('aria-label'),
      min: el.getAttribute('aria-valuemin'),
      max: el.getAttribute('aria-valuemax'),
      tabindex: el.getAttribute('tabindex'),
    }));
    expect(
      JSON.stringify(attrs) === JSON.stringify({ role: 'slider', name: 'Rating', min: '0', max: '5', tabindex: '0' }),
      `${path}: expected one focusable slider named Rating from 0 to 5, found ${q(attrs)}`,
    );
    const live = await c.page.locator(tid(r.status)).evaluate((el) => ({ role: el.getAttribute('role'), live: el.getAttribute('aria-live') }));
    expect(live.role === 'status' && live.live === 'polite', `${path}: expected the rating status to be a polite live region, found ${q(live)}`);
    await c.checkGates(`${path} (not rated)`);

    await clickStar(c, 4);
    await waitForStatus(c, 'Rated 4 stars', path);
    await waitForValue(c, '4 out of 5 stars', `${path} (after the tap)`);
    await c.checkGates(`${path} (rated)`);
    await c.snap('rating-detail-light');

    // Read the rating back from another screen: the Shelf lists the book from the database.
    await c.page.locator(tid(Testids.bookDetail.back)).click();
    await waitForPath(c, '/', `${path} -> back`);
    await waitForRow(c, 'The Light Fantastic', 'The Light Fantastic, by Terry Pratchett, 1986, rated 4 out of 5', '/ (after rating)');
    await c.snap('rating-shelf-rows-light');

    // And from a fresh page load.
    await c.goto(path);
    await waitForValue(c, '4 out of 5 stars', `${path} (after a reload)`);
    await clickStar(c, 4);
    await waitForStatus(c, 'Rating cleared', `${path} (second tap)`);
    await waitForValue(c, 'Not rated', `${path} (second tap)`);
  },
});

register({
  name: 'rating-form',
  suite: 'p10',
  desc: 'Add a book with 5 stars in the form → its page shows 5 stars; edit a demo book, change 4 stars to 2 with the keyboard, save → its page and its Shelf row say 2',
  async run(c) {
    await openFixture(c, 'empty', '/book/new', TODAY);
    await waitVisible(c, tid(Testids.bookForm.title), '/book/new');
    await c.page.locator(tid(Testids.bookForm.title)).fill('Piranesi');
    await c.page.locator(tid(Testids.bookForm.rating)).scrollIntoViewIfNeeded();
    await clickStar(c, 5);
    await waitForValue(c, '5 out of 5 stars', '/book/new');
    await c.checkGates('/book/new (rated)');
    await c.snap('rating-form-light');
    await c.page.locator(tid(Testids.bookForm.save)).click();
    const added = await waitForPath(c, /^\/book\/\d+$/, '/book/new -> save');
    await waitForValue(c, '5 out of 5 stars', added);

    await openFixture(c, 'demo', '/', TODAY);
    await waitForCount(c, row, 12, '/');
    const path = await openRow(c, 'The Colour of Magic');
    await c.page.locator(tid(Testids.bookDetail.edit)).click();
    await waitForPath(c, `${path}/edit`, `${path} -> Edit`);
    await waitForValue(c, '4 out of 5 stars', `${path}/edit`);
    await control(c).focus();
    await c.page.keyboard.press('ArrowLeft');
    await c.page.keyboard.press('ArrowLeft');
    await waitForValue(c, '2 out of 5 stars', `${path}/edit (two stars fewer)`);
    await c.page.locator(tid(Testids.bookForm.save)).click();
    await waitForPath(c, path, `${path}/edit -> save`);
    await waitForValue(c, '2 out of 5 stars', `${path} (saved)`);
    await c.page.locator(tid(Testids.bookDetail.back)).click();
    await waitForPath(c, '/', `${path} -> back`);
    await waitForRow(c, 'The Colour of Magic', 'The Colour of Magic, by Terry Pratchett, 1983, rated 2 out of 5', '/ (after the edit)');
  },
});

register({
  name: 'rating-sort-filter',
  suite: 'p10',
  desc: 'Fixture "demo": sort by Rating puts the 5-star books first and the 5 unrated last, either way round; the filter sheet\'s "4 stars and up" leaves 5 books with a removable chip; group by Rating makes star sections; all kept after a reload',
  async run(c) {
    await openFixture(c, 'demo', '/', TODAY);
    await waitForCount(c, row, 12, '/');
    await c.page.locator(tid(Testids.home.sortButton)).click();
    await c.page.locator(tid(Testids.home.sortRating)).click();
    expect((await c.page.locator(tid(Testids.home.sortRating)).getAttribute('aria-checked')) === 'true', '/: expected the Rating sort option checked');
    await c.page.waitForFunction((sel) => /rated 5 out of 5$/.test(document.querySelector(sel)?.getAttribute('aria-label') ?? ''), row, { timeout: 10_000 }).catch(() => {});
    const stars = (names: string[]) => names.map((n) => Number(/, rated (\d) out of 5/.exec(n)?.[1] ?? 0));
    const desc = stars(await rowNames(c));
    expect(JSON.stringify(desc) === JSON.stringify([5, 5, 5, 4, 4, 3, 3, 0, 0, 0, 0, 0]), `/ (rating, highest first): expected 5,5,5,4,4,3,3 then 5 unrated, found ${q(desc)}`);
    const button = await text(c, tid(Testids.home.sortButton));
    expect(button.endsWith('Sort: Rating, Highest first'), `/: expected the sort button to say ${q('Sort: Rating, Highest first')}, found ${q(button)}`);
    await c.checkGates('/ (sort by rating)');
    await c.snap('rating-sort-light');

    await c.page.locator(tid(Testids.home.sortDirection)).click();
    await c.page.waitForFunction((sel) => /rated 3 out of 5/.test(document.querySelector(sel)?.getAttribute('aria-label') ?? ''), row, { timeout: 10_000 }).catch(() => {});
    const asc = stars(await rowNames(c));
    expect(JSON.stringify(asc) === JSON.stringify([3, 3, 4, 4, 5, 5, 5, 0, 0, 0, 0, 0]), `/ (rating, lowest first): expected 3,3,4,4,5,5,5 then the unrated, found ${q(asc)}`);
    await c.page.locator(tid(Testids.home.sortDirection)).click();
    await c.page.locator(tid(Testids.home.sortButton)).click();

    await c.page.locator(tid(sv.filterButton)).click();
    await waitVisible(c, tid(sv.filterSheet), '/ filter sheet');
    const choice = c.page.locator(`${tid(sv.filterRating)}[aria-label="4 stars and up"]`);
    await choice.scrollIntoViewIfNeeded();
    await choice.click();
    expect((await choice.getAttribute('aria-checked')) === 'true', '/ filter sheet: expected "4 stars and up" checked');
    expect((await c.page.locator(tid(sv.filterRatingAny)).getAttribute('aria-checked')) === 'false', '/ filter sheet: expected "Any" no longer checked');
    await c.checkGates('/ (filter sheet, rating)');
    await c.snap('rating-filter-sheet-light');
    await c.page.locator(tid(sv.filterDone)).click();
    await waitForCount(c, row, 5, '/ (4 stars and up)');
    const chips = await c.page.locator(tid(sv.filterChip)).allInnerTexts();
    expect(chips.some((t) => t.includes('4 stars and up')), `/ (4 stars and up): expected a "4 stars and up" chip, found ${q(chips)}`);
    const summary = await text(c, tid(Testids.home.resultCount));
    expect(summary === '5 of 12 books match your filters', `/ (4 stars and up): found ${q(summary)}`);
    await c.snap('rating-filtered-light');

    await c.page.locator(tid(sv.groupByButton)).click();
    await c.page.locator(tid(sv.groupByRating)).click();
    await c.page
      .waitForFunction((sel) => document.querySelectorAll(sel).length === 2, tid(sv.sectionHeader), { timeout: 10_000 })
      .catch(() => {});
    const headers = await c.page.locator(`${tid(sv.sectionHeader)} [role="heading"]`).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(JSON.stringify(headers) === JSON.stringify(['5 stars, 3 books', '4 stars, 2 books']), `/ (grouped by rating): expected two star sections, found ${q(headers)}`);
    await c.checkGates('/ (grouped by rating)');

    // Sort, filter and grouping are settings: they survive a reload. Read them back first, from the settings
    // screen (its values come from the database): the filter was saved before the grouping, so once the
    // grouping shows there both are stored.
    await openSetting(c, Testids.settings.preferences, '/settings/preferences');
    const sortField = await c.page.locator(tid(Testids.settings.sort)).getAttribute('aria-label');
    expect(sortField === 'Sort the shelf by: Rating, highest first', `/settings/preferences: expected the rating sort stored, found ${q(sortField)}`);
    const groupField = await c.page.locator(tid(Testids.settings.groupBy)).getAttribute('aria-label');
    expect(groupField === 'Split the shelf into sections by: Rating', `/settings/preferences: expected grouping by rating stored, found ${q(groupField)}`);
    await c.goto('/');
    await waitForCount(c, row, 5, '/ after reload');
    const kept = await text(c, tid(Testids.home.sortButton));
    expect(kept.endsWith('Sort: Rating, Highest first'), `/ after reload: expected the rating sort kept, found ${q(kept)}`);
    await c.page.locator(`${tid(sv.filterChipRemove)}[aria-label="Remove filter 4 stars and up"]`).click();
    await waitForCount(c, row, 12, '/ (filter removed)');
  },
});

register({
  name: 'rating-goodreads-import',
  suite: 'p10',
  desc: 'Fixture "empty": import the Goodreads export → its "My Rating" becomes each book\'s rating (5 → 5 stars, 1 → 1 star, 0 → not rated), in the rows\' names, on the covers grid and on a book\'s page',
  async run(c) {
    // Open Library only, as the Goodreads journey does: the recorded fixtures cover it.
    await openFixture(c, 'empty', '/settings', TODAY);
    await c.page.locator(tid(Testids.settings.googleBooksToggle)).click();
    await openSetting(c, Testids.settings.importCsv, '/settings/import-csv');
    await upload(c, tid(Testids.csvImport.pick), GOODREADS_CSV, '/settings/import-csv');
    await waitForText(c, tid(Testids.csvImport.preview), /20 books will be added/, '/settings/import-csv');
    const mapped = await c.page.locator(tid(Testids.csvImport.mapField)).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    expect(mapped.some((l) => l.includes('My Rating') && l.includes('Your rating')), `/settings/import-csv: expected "My Rating" mapped to Your rating, found ${q(mapped)}`);
    await c.page.locator(tid(Testids.csvImport.confirm)).click();
    await waitForText(c, tid(Testids.csvImport.report), /Imported 20 books/, '/settings/import-csv (import)');
    await c.page.locator(tid(Testids.csvImport.done)).click();
    await waitForPath(c, '/', '/settings/import-csv -> shelf');
    await waitForText(c, tid(Testids.home.bookCount), /20 books/i, '/ after import');
    await waitForCount(c, row, 20, '/ after import');

    const ratings = await ratingsOnShelf(c);
    const want = { 'The Hobbit': 5, 'Circe': 4, 'The Science of Discworld': 3, 'Norse Mythology': 2, 'The Martian': 1, 'The Name of the Wind': null, 'Leviathan Wakes': null };
    const got = Object.fromEntries(Object.keys(want).map((k) => [k, ratings[k]]));
    expect(JSON.stringify(got) === JSON.stringify(want), `/: expected the Goodreads ratings ${q(want)}, found ${q(got)}`);
    expect(Object.values(ratings).filter((x) => x != null).length === 16, `/: expected 16 rated books (4 were 0 in the file), found ${q(ratings)}`);

    // Let the cover backfill finish on the covers grid, where each rated cover shows its stars.
    const { cells } = await waitForGridCovers(c, { count: 20, timeout: 45_000 });
    expect(cells.filter((x) => /rated \d out of 5/.test(x.label)).length === 16, `/ (covers grid): expected 16 cells named with their rating, found ${q(cells.map((x) => x.label))}`);
    const drawn = await c.page.locator(`${tid(sv.coverCell)} ${tid(r.display)}`).count();
    expect(drawn === 16, `/ (covers grid): expected stars under 16 covers, found ${drawn}`);
    await c.checkGates('/ (covers grid, ratings)');
    await c.snap('rating-covers-grid-light');
    await c.page.locator(tid(sv.modeList)).click();
    await openRow(c, 'The Martian');
    await waitForValue(c, '1 out of 5 stars', '/book (The Martian)');
  },
});

register({
  name: 'rating-backup-roundtrip',
  suite: 'p10',
  desc: 'Fixture "demo": rate one more book → save a backup (its books carry "rating") → erase → restore → every rating is back; a copy of the file made to look like a schema 6 backup (no ratings) restores too, with every book not rated',
  async run(c) {
    await openFixture(c, 'demo', '/', TODAY);
    await waitForCount(c, row, 12, '/');
    const path = await openRow(c, 'The Left Hand of Darkness');
    await clickStar(c, 2);
    await waitForStatus(c, 'Rated 2 stars', path);
    await c.page.locator(tid(Testids.bookDetail.back)).click();
    await waitForPath(c, '/', `${path} -> back`);
    await waitForRow(c, 'The Left Hand of Darkness', 'The Left Hand of Darkness, by Ursula K. Le Guin, 1969, rated 2 out of 5', '/');
    const before = await ratingsOnShelf(c);

    await openSetting(c, Testids.settings.exportBackup, '/settings/backup');
    await waitForText(c, tid(Testids.backup.contents), /12 books/, '/settings/backup');
    const file = await download(c, tid(Testids.backup.export), '/settings/backup');
    const doc = JSON.parse(file.text) as { schemaVersion: number; tables: { books: { title: string; rating: number | null }[] } };
    const inFile = Object.fromEntries(doc.tables.books.map((b) => [b.title, b.rating]));
    expect(doc.tables.books.every((b) => 'rating' in b), 'backup: expected every book to carry a rating field');
    expect(inFile['The Left Hand of Darkness'] === 2 && inFile['Mort'] === 5 && inFile['The Light Fantastic'] === null, `backup: expected the ratings in the file, found ${q(inFile)}`);
    expect(doc.schemaVersion >= 7, `backup: expected schema version 7 or later, found ${doc.schemaVersion}`);

    // Replace everything with the backup (the ratings change first, so the restore has something to put back).
    await openShelf(c);
    const other = await openRow(c, 'Mort');
    await c.page.locator(tid(r.clear)).filter({ visible: true }).click();
    await waitForStatus(c, 'Rating cleared', other);
    await c.page.locator(tid(Testids.bookDetail.back)).click();
    await waitForPath(c, '/', `${other} -> back`);
    await waitForRow(c, 'Mort', 'Mort, by Terry Pratchett, 1987', '/ (Mort cleared)');
    await restore(c, file.path, /12 books/);
    await waitForCount(c, row, 12, '/ after restore');
    const after = await ratingsOnShelf(c);
    expect(JSON.stringify(after) === JSON.stringify(before), `/ after restore: expected the ratings ${q(before)}, found ${q(after)}`);
    await c.snap('rating-restored');

    // The same library as an app from before ratings would have saved it.
    const old = { ...doc, schemaVersion: 6, tables: { ...doc.tables, books: doc.tables.books.map(({ rating: _r, ...b }) => b) } };
    const oldPath = join(c.runDir, 'myshelf-backup-schema6.json');
    await writeFile(oldPath, JSON.stringify(old));
    await restore(c, oldPath, /older version/);
    await waitForCount(c, row, 12, '/ after the schema 6 restore');
    const none = Object.values(await ratingsOnShelf(c)).filter((x) => x != null);
    expect(none.length === 0, `/ after the schema 6 restore: expected no ratings, found ${q(none)}`);
  },
});

register({
  name: 'rating-keyboard',
  suite: 'p10',
  desc: 'Keyboard only on an unrated book: Tab reaches the Rating slider (the stars themselves are not tab stops); ArrowRight ×3 → 3 stars, End → 5, ArrowLeft → 4, Home → not rated, a digit sets it; each change is saved and announced; Tab moves on to Clear rating, whose Enter clears and hands focus back to the slider',
  async run(c) {
    await openFixture(c, 'demo', '/', TODAY);
    await waitForCount(c, row, 12, '/');
    const path = await openRow(c, 'The Farthest Shore');
    const stops = await control(c).locator(tid(r.star)).evaluateAll((els) => els.map((e) => e.getAttribute('tabindex')));
    expect(stops.length === 5 && stops.every((t) => t === '-1'), `${path}: expected five stars out of the tab order, found ${q(stops)}`);
    const hidden = await control(c).locator(tid(r.star)).first().evaluate((e) => !!e.closest('[aria-hidden="true"]'));
    expect(hidden, `${path}: expected the stars hidden from screen readers (the slider speaks for them)`);

    // Tab from the Back button until the slider has focus.
    await c.page.locator(tid(Testids.bookDetail.back)).focus();
    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await c.page.keyboard.press('Tab');
      reached = (await focused(c)) === r.control;
    }
    expect(reached, `${path}: expected Tab to reach the rating slider, focus is on ${q(await focused(c))}`);

    const steps: [string, string, string][] = [
      ['ArrowRight', '1 out of 5 stars', 'Rated 1 star'],
      ['ArrowRight', '2 out of 5 stars', 'Rated 2 stars'],
      ['ArrowUp', '3 out of 5 stars', 'Rated 3 stars'],
      ['End', '5 out of 5 stars', 'Rated 5 stars'],
      ['ArrowLeft', '4 out of 5 stars', 'Rated 4 stars'],
      ['Home', 'Not rated', 'Rating cleared'],
      ['3', '3 out of 5 stars', 'Rated 3 stars'],
    ];
    for (const [key, value, status] of steps) {
      await c.page.keyboard.press(key);
      await waitForValue(c, value, `${path} (${key})`);
      await waitForStatus(c, status, `${path} (${key})`);
      const now = await focused(c);
      expect(now === r.control, `${path} (${key}): expected focus to stay on the slider, found ${q(now)}`);
    }
    await c.checkGates(`${path} (keyboard)`);
    await c.snap('rating-keyboard-focus');

    await c.page.keyboard.press('Tab');
    const next = await focused(c);
    expect(next === r.clear, `${path}: expected Tab to move on to Clear rating, found ${q(next)}`);
    await c.page.keyboard.press('Enter');
    await waitForValue(c, 'Not rated', `${path} (Clear rating)`);
    await waitForStatus(c, 'Rating cleared', `${path} (Clear rating)`);
    const back = await focused(c);
    expect(back === r.control, `${path}: expected focus back on the slider once Clear rating is disabled, found ${q(back)}`);

    // Saved: the Shelf reads it back.
    await c.page.keyboard.press('3');
    await waitForStatus(c, 'Rated 3 stars', path);
    await c.page.locator(tid(Testids.bookDetail.back)).click();
    await waitForPath(c, '/', `${path} -> back`);
    await waitForRow(c, 'The Farthest Shore', 'The Farthest Shore, by Ursula K. Le Guin, 1972, rated 3 out of 5', '/ (keyboard rating)');
  },
});

register({
  name: 'rating-dark',
  suite: 'p10',
  desc: 'Dark system scheme, fixture "demo": the stars on a book\'s page, in the edit form, on Shelf rows, under covers and in the sort menu and filter sheet paint the dark theme\'s primary (filled) and outline (empty) and pass the page gates; a screenshot of each',
  async run(c) {
    await c.page.emulateMedia({ colorScheme: 'dark' });
    await openFixture(c, 'demo', '/', TODAY);
    await waitForCount(c, row, 12, '/');
    await c.page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', undefined, { timeout: 10_000 }).catch(() => {});
    const rowStars = await c.page.locator(`${row} ${tid(r.display)}`).count();
    expect(rowStars === 7, `/ (dark): expected stars on the 7 rated rows, found ${rowStars}`);
    await c.checkGates('/ (dark)');
    await c.snap('rating-shelf-rows-dark');

    await c.page.locator(tid(Testids.home.sortButton)).click();
    await c.page.locator(tid(Testids.home.sortRating)).click();
    await c.checkGates('/ (dark, sort by rating)');
    await c.snap('rating-sort-dark');
    await c.page.locator(tid(Testids.home.sortButton)).click();
    await c.page.locator(tid(sv.filterButton)).click();
    await waitVisible(c, tid(sv.filterSheet), '/ filter sheet (dark)');
    const choice = c.page.locator(`${tid(sv.filterRating)}[aria-label="4 stars and up"]`);
    await choice.scrollIntoViewIfNeeded();
    await choice.click();
    await c.checkGates('/ (dark, filter sheet)');
    await c.snap('rating-filter-sheet-dark');
    await c.page.locator(tid(sv.filterDone)).click();
    await waitForCount(c, row, 5, '/ (dark, 4 stars and up)');
    await c.page.locator(tid(sv.modeCovers)).click();
    await waitForCount(c, tid(sv.coverCell), 5, '/ (dark covers)');
    await c.snap('rating-covers-dark');
    await c.page.locator(tid(sv.modeList)).click();
    await waitForCount(c, row, 5, '/ (dark list)');

    const path = await openRow(c, 'Dune');
    await waitForValue(c, '4 out of 5 stars', path);
    const colours = await control(c).locator(tid(r.star)).evaluateAll((els) =>
      els.map((e) => {
        const glyph = e.querySelector('div[dir], span, div') as HTMLElement | null;
        return getComputedStyle(glyph ?? e).color;
      }),
    );
    const want = [...Array(4).fill(rgb(darkColors.primary)), rgb(darkColors.outline)];
    expect(JSON.stringify(colours) === JSON.stringify(want), `${path} (dark): expected four stars in ${darkColors.primary} and one in ${darkColors.outline}, found ${q(colours)}`);
    expect(!colours.includes(rgb(lightColors.primary)), `${path} (dark): a star still has the light theme's primary`);
    await c.checkGates(`${path} (dark)`);
    await c.snap('rating-detail-dark');

    await c.page.locator(tid(Testids.bookDetail.edit)).click();
    await waitForPath(c, `${path}/edit`, `${path} -> Edit`);
    await c.page.locator(tid(Testids.bookForm.rating)).scrollIntoViewIfNeeded();
    await waitForValue(c, '4 out of 5 stars', `${path}/edit`);
    await c.checkGates(`${path}/edit (dark)`);
    await c.snap('rating-form-dark');
  },
});
