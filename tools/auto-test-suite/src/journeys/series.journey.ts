// Phase 04 journeys: series in the book form, the series list and shelf,
// the series on a book's page, confirming a guessed series, Booky's gap tip
// and the completion celebration.
import { Testids, tid } from '../selectors.ts';
import { openFixture, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const si = Testids.seriesInput;
const sd = Testids.seriesDetail;
const bs = Testids.bookSeries;

/** Only the element on the screen showing now: a stack keeps the screens underneath in the DOM, hidden. */
const vis = (selector: string) => `${selector} >> visible=true`;

async function textOf(c: Context, selector: string): Promise<string> {
  return (await c.page.locator(vis(selector)).first().innerText()).replace(/\s+/g, ' ').trim();
}

async function count(c: Context, selector: string): Promise<number> {
  return c.page.locator(vis(selector)).count();
}

async function click(c: Context, selector: string): Promise<void> {
  await c.page.locator(vis(selector)).first().click();
}

async function fill(c: Context, selector: string, value: string): Promise<void> {
  await c.page.locator(vis(selector)).first().fill(value);
}

/** Opens a book from the Shelf by the start of its row label. */
async function openBook(c: Context, title: string): Promise<string> {
  await c.page.locator(`${tid(Testids.home.row)}[aria-label^="${title},"]`).click();
  const path = await waitForPath(c, /^\/book\/\d+$/, `/ -> ${title}`);
  await waitVisible(c, vis(tid(Testids.bookDetail.title)), path);
  return path;
}

/** The series rows' accessible names, top to bottom. */
async function seriesRows(c: Context): Promise<string[]> {
  return c.page.locator(vis(tid(Testids.seriesList.row))).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') || ''));
}

/** Opens a series from /series by name. */
async function openSeries(c: Context, name: string): Promise<string> {
  await c.page.locator(vis(`${tid(Testids.seriesList.row)}[aria-label^="${name},"]`)).click();
  const path = await waitForPath(c, /^\/series\/\d+$/, `/series -> ${name}`);
  await waitVisible(c, vis(tid(sd.title)), path);
  const title = await textOf(c, tid(sd.title));
  expect(title === name, `${path}: expected the h1 ${q(name)}, found ${q(title)}`);
  return path;
}

async function waitForText(c: Context, selector: string, want: string | RegExp, where: string): Promise<string> {
  const ok = await c.page
    .waitForFunction(
      ([sel, w, isRe]) => {
        const el = [...document.querySelectorAll<HTMLElement>(sel as string)].find((e) => e.offsetParent !== null);
        const t = (el?.innerText ?? '').replace(/\s+/g, ' ').trim();
        return isRe ? new RegExp(w as string).test(t) : t.includes(w as string);
      },
      [selector, want instanceof RegExp ? want.source : want, want instanceof RegExp] as const,
      { timeout: 10_000 },
    )
    .then(() => true)
    .catch(() => false);
  const got = ok ? await textOf(c, selector) : await textOf(c, selector).catch(() => '(not found)');
  expect(ok, `${where}: expected ${selector} to show ${q(String(want))}, found ${q(got)}`);
  return got;
}

async function waitGone(c: Context, selector: string, where: string): Promise<void> {
  try {
    await c.page.locator(vis(selector)).first().waitFor({ state: 'detached', timeout: 10_000 });
  } catch {
    expect((await count(c, selector)) === 0, `${where}: expected ${selector} to go away`);
  }
}

register({
  name: 'series-list',
  suite: 'p04',
  desc: 'Fixture "demo": /series lists Discworld and Earthsea with mini shelves and "3 of 4 owned, 1 missing"; the sort radios work; a row opens the series',
  async run(c) {
    await openFixture(c, 'demo', '/series');
    await waitForCount(c, tid(Testids.seriesList.row), 2, '/series');
    const rows = await seriesRows(c);
    const want = ['Discworld, 3 of 4 owned, 1 missing', 'Earthsea, 2 of 3 owned, 1 missing'];
    expect(JSON.stringify(rows) === JSON.stringify(want), `/series: expected rows ${q(want)}, found ${q(rows)}`);
    const first = await textOf(c, tid(Testids.seriesList.row));
    expect(first.includes('3 of 4'), `/series: expected the Discworld row to show "3 of 4", found ${q(first)}`);
    await c.snap('series-list');

    await click(c, tid(Testids.seriesList.sortRecent));
    await c.page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('aria-checked') === 'true', tid(Testids.seriesList.sortRecent), { timeout: 5_000 }).catch(() => {});
    const checked = await c.page.locator(tid(Testids.seriesList.sortRecent)).getAttribute('aria-checked');
    expect(checked === 'true', `/series: expected "Recently added" to be checked, found aria-checked=${q(checked)}`);
    await c.checkGates('/series (recent)');

    await openSeries(c, 'Earthsea');
  },
});

register({
  name: 'series-detail-gaps',
  suite: 'p04',
  desc: 'Fixture "demo": Discworld\'s shelf shows #1, #2, a dashed "#3 missing" and #4 in order; Add #3 opens the add form with the series filled in',
  async run(c) {
    await openFixture(c, 'demo', '/series');
    const path = await openSeries(c, 'Discworld');
    await c.checkGates(path);
    const progress = await textOf(c, tid(sd.progress));
    expect(progress.includes('3 of 4 owned, 1 missing'), `${path}: expected the progress "3 of 4 owned, 1 missing", found ${q(progress)}`);

    // The shelf, in order: spines and the one gap.
    const shelf = await c.page.locator(vis(tid(sd.shelf))).evaluate(
      (el, [spine, gap]) =>
        [...el.querySelectorAll<HTMLElement>(`${spine}, ${gap}`)].map((s) => (s.matches(gap!) ? `gap ${s.innerText.replace(/\s+/g, ' ').trim()}` : s.innerText.split('\n').pop()?.trim())),
      [tid(sd.spine), tid(sd.gap)],
    );
    const wantShelf = ['#1', '#2', 'gap #3 missing', '#4'];
    expect(JSON.stringify(shelf) === JSON.stringify(wantShelf), `${path}: expected the shelf ${q(wantShelf)}, found ${q(shelf)}`);

    // The list reads the same, with covers.
    const books = await c.page.locator(vis(tid(sd.book))).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    const wantBooks = ['Number 1, The Colour of Magic, 1983', 'Number 2, The Light Fantastic, 1986', 'Number 4, Mort, 1987'];
    expect(JSON.stringify(books) === JSON.stringify(wantBooks), `${path}: expected the books ${q(wantBooks)}, found ${q(books)}`);
    expect((await count(c, tid(sd.addGap))) === 1, `${path}: expected one Add button, for #3`);
    await c.snap('series-detail-shelf');

    await click(c, tid(sd.addGap));
    await waitForPath(c, '/book/new', `${path} -> Add #3`);
    await waitVisible(c, vis(tid(si.search)), '/book/new');
    const name = await c.page.locator(vis(tid(si.search))).inputValue();
    const position = await c.page.locator(vis(tid(si.position))).inputValue();
    expect(name === 'Discworld' && position === '3', `/book/new: expected the series Discworld #3 filled in, found ${q(name)} #${q(position)}`);
    await c.checkGates('/book/new (Add #3)');
  },
});

register({
  name: 'series-assign-in-form',
  suite: 'p04',
  desc: 'Fixture "demo": edit Good Omens -> search "disc" -> pick Discworld -> number "III" reads as #3 -> save -> Book 3 between #2 and #4 -> the series has no gap',
  async run(c) {
    await openFixture(c, 'demo', '/');
    const path = await openBook(c, 'Good Omens');
    await click(c, tid(Testids.bookDetail.edit));
    await waitForPath(c, `${path}/edit`, `${path} -> Edit`);
    await waitVisible(c, vis(tid(si.search)), `${path}/edit`);

    await fill(c, tid(si.search), 'disc');
    await waitVisible(c, vis(tid(si.option)), `${path}/edit (search)`);
    const option = await c.page.locator(vis(tid(si.option))).first().getAttribute('aria-label');
    expect(option === 'Discworld, 3 books in your library', `${path}/edit: expected the option "Discworld, 3 books in your library", found ${q(option)}`);
    expect((await count(c, tid(si.create))) === 1, `${path}/edit: expected a "New series" option too`);
    await click(c, tid(si.option));
    await waitForText(c, tid(si.status), 'In your library · 3 books', `${path}/edit (picked)`);
    expect((await count(c, tid(si.option))) === 0, `${path}/edit: expected the options to close after picking`);

    await fill(c, tid(si.position), 'III');
    await waitVisible(c, vis('text=Saves as #3'), `${path}/edit (position)`);
    await c.page.locator(vis(tid(si.search))).scrollIntoViewIfNeeded();
    await c.checkGates(`${path}/edit (series)`);
    await c.snap('series-input');

    await click(c, tid(Testids.bookForm.save));
    await waitForPath(c, path, `${path}/edit -> save`);
    await waitForText(c, tid(bs.place), 'Book 3', path);
    await waitForText(c, tid(bs.previous), 'The Light Fantastic (#2)', path);
    await waitForText(c, tid(bs.next), 'Mort (#4)', path);
    await c.page.locator(vis(tid(bs.link))).scrollIntoViewIfNeeded();
    await c.snap('book-series-after-assign');

    await click(c, tid(bs.link));
    const series = await waitForPath(c, /^\/series\/\d+$/, `${path} -> series`);
    await waitVisible(c, vis(tid(sd.title)), series);
    await waitForText(c, tid(sd.progress), '4 of 4 owned, none missing so far', series);
    expect((await count(c, tid(sd.addGap))) === 0, `${series}: expected no gaps after adding #3`);
  },
});

register({
  name: 'series-book-section',
  suite: 'p04',
  desc: 'Fixture "demo": The Light Fantastic shows "Book 2", Previous: The Colour of Magic (#1), Next: #3 not on your shelf; previous and the series link navigate',
  async run(c) {
    await openFixture(c, 'demo', '/');
    const path = await openBook(c, 'The Light Fantastic');
    await waitForText(c, tid(bs.place), 'Book 2', path);
    await waitForText(c, tid(Testids.bookDetail.series), '3 of 4 owned, 1 missing', path);
    await waitForText(c, tid(bs.previous), 'Previous: The Colour of Magic (#1)', path);
    await waitForText(c, tid(bs.next), 'Next: #3 isn’t on your shelf yet', path);
    const role = await c.page.locator(vis(tid(bs.next))).getAttribute('role');
    expect(role !== 'link', `${path}: a missing next book should not be a link, found role=${q(role)}`);
    await c.page.locator(vis(tid(Testids.bookDetail.series))).scrollIntoViewIfNeeded();
    await c.checkGates(`${path} (series)`);
    await c.snap('book-series-section');

    await click(c, tid(bs.previous));
    const prev = await waitForPath(c, /^\/book\/\d+$/, `${path} -> previous`);
    await waitForText(c, tid(Testids.bookDetail.title), 'The Colour of Magic', prev);
    expect((await count(c, tid(bs.previous))) === 0, `${prev}: the first book should have no previous`);
    await waitForText(c, tid(bs.next), 'The Light Fantastic (#2)', prev);

    await click(c, tid(bs.link));
    const series = await waitForPath(c, /^\/series\/\d+$/, `${prev} -> series`);
    await waitForText(c, tid(sd.title), 'Discworld', series);
  },
});

register({
  name: 'series-confirm-detected',
  suite: 'p04',
  desc: 'Fixture "series": Guards! Guards! asks "Is this Discworld #8?" -> Yes hides it for good; The Name of the Wind -> Not a series removes the series and stays removed',
  async run(c) {
    await openFixture(c, 'series', '/');
    const guards = await openBook(c, 'Guards! Guards!');
    await waitForText(c, tid(Testids.seriesConfirm.root), 'Is this Discworld #8?', guards);
    await c.page.locator(vis(tid(Testids.seriesConfirm.root))).scrollIntoViewIfNeeded();
    await c.checkGates(`${guards} (confirm)`);
    await c.snap('series-confirm');
    await click(c, tid(Testids.seriesConfirm.yes));
    await waitGone(c, tid(Testids.seriesConfirm.root), `${guards} (Yes)`);
    await waitForText(c, tid(bs.place), 'Book 8', guards);
    await c.goto(guards);
    await waitVisible(c, vis(tid(bs.place)), `${guards} (reloaded)`);
    expect((await count(c, tid(Testids.seriesConfirm.root))) === 0, `${guards}: the question came back after Yes`);

    await c.goto('/');
    const wind = await openBook(c, 'The Name of the Wind');
    await waitForText(c, tid(Testids.seriesConfirm.root), 'Is this The Kingkiller Chronicle #1?', wind);
    await click(c, tid(Testids.seriesConfirm.no));
    await waitGone(c, tid(Testids.bookDetail.series), `${wind} (Not a series)`);
    await c.goto(wind);
    await waitVisible(c, vis(tid(Testids.bookDetail.title)), `${wind} (reloaded)`);
    await c.page.waitForTimeout(500);
    expect((await count(c, tid(Testids.bookDetail.series))) === 0, `${wind}: the series came back after "Not a series"`);
  },
});

register({
  name: 'series-gap-tip',
  suite: 'p04',
  desc: 'Fixture "demo": add Discworld #6 by hand -> Booky: "You have #1, #2, #4 and #6 of Discworld — #3 and #5 are missing." -> See the series; a second save into Discworld does not repeat it',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await c.goto('/book/new?series=Discworld&position=6');
    await waitVisible(c, vis(tid(Testids.bookForm.title)), '/book/new');
    await fill(c, tid(Testids.bookForm.title), 'Wyrd Sisters');
    await click(c, tid(Testids.bookForm.save));
    const path = await waitForPath(c, /^\/book\/\d+$/, '/book/new -> save');
    const tip = await waitForText(c, tid(Testids.seriesTip.text), 'You have #1, #2, #4 and #6 of Discworld — #3 and #5 are missing.', path);
    expect(tip.length > 0, `${path}: expected Booky's gap tip`);
    const booky = await c.page.locator(vis(`${tid(Testids.seriesTip.root)} [role="img"]`)).first().getAttribute('aria-label');
    expect(booky === 'Booky the bookmark, thinking', `${path}: expected thinking Booky, found ${q(booky)}`);
    await c.checkGates(`${path} (gap tip)`);
    await c.snap('series-gap-tip');

    await click(c, tid(Testids.seriesTip.open));
    const series = await waitForPath(c, /^\/series\/\d+$/, `${path} -> See the series`);
    await waitForText(c, tid(sd.progress), '4 of 6 owned, 2 missing', series);
    expect((await count(c, tid(Testids.seriesTip.root))) === 0, `${series}: expected the tip to close`);

    // Once per series: adding #8 (which opens #7) says nothing more.
    await c.goto('/book/new?series=Discworld&position=8');
    await waitVisible(c, vis(tid(Testids.bookForm.title)), '/book/new (second)');
    await fill(c, tid(Testids.bookForm.title), 'Pyramids');
    await click(c, tid(Testids.bookForm.save));
    const second = await waitForPath(c, /^\/book\/\d+$/, '/book/new (second) -> save');
    await waitVisible(c, vis(tid(bs.place)), second);
    await c.page.waitForTimeout(1_000);
    expect((await count(c, tid(Testids.seriesTip.root))) === 0, `${second}: the gap tip showed twice for Discworld`);
  },
});

/** Earthsea (#1, #3): set the total to 3, then add #2 from its gap. */
async function completeEarthsea(c: Context): Promise<string> {
  await openFixture(c, 'demo', '/series');
  const path = await openSeries(c, 'Earthsea');
  await fill(c, tid(sd.totalCount), '3');
  await click(c, tid(sd.totalSave));
  await waitForText(c, tid(Testids.snackbar.root), 'Saved: Earthsea has 3 books', path);
  expect((await count(c, tid(Testids.seriesCelebration.root))) === 0, `${path}: celebrated before the series was complete`);
  await click(c, tid(sd.addGap));
  await waitForPath(c, '/book/new', `${path} -> Add #2`);
  await waitVisible(c, vis(tid(Testids.bookForm.title)), '/book/new');
  await fill(c, tid(Testids.bookForm.title), 'The Tombs of Atuan');
  await click(c, tid(Testids.bookForm.save));
  const book = await waitForPath(c, /^\/book\/\d+$/, '/book/new -> save');
  await waitForText(c, tid(Testids.seriesCelebration.text), 'Series complete! All 3 Earthsea books.', book);
  return book;
}

register({
  name: 'series-complete-celebration',
  suite: 'p04',
  desc: 'Fixture "demo": Earthsea total 3 -> Add #2 -> save -> excited Booky says "Series complete! All 3 Earthsea books." with falling bookmarks -> dismiss',
  async run(c) {
    const book = await completeEarthsea(c);
    const booky = await c.page.locator(vis(`${tid(Testids.seriesCelebration.root)} [role="img"]`)).first().getAttribute('aria-label');
    expect(booky === 'Booky the bookmark, looking excited', `${book}: expected excited Booky, found ${q(booky)}`);
    await c.page.locator(tid(Testids.seriesCelebration.confetti)).first().waitFor({ state: 'attached', timeout: 5_000 }).catch(() => {});
    const pieces = await c.page.locator(`${tid(Testids.seriesCelebration.confetti)} > div`).count();
    expect(pieces > 0, `${book}: expected falling bookmarks, found ${pieces}`);
    const hidden = await c.page.locator(tid(Testids.seriesCelebration.confetti)).getAttribute('aria-hidden');
    expect(hidden === 'true', `${book}: expected the confetti hidden from assistive tech, found aria-hidden=${q(hidden)}`);
    await c.page.waitForTimeout(700);
    await c.snap('series-celebration');
    await c.checkGates(`${book} (celebration)`);
    // The shower is one-time: it clears itself.
    await c.page.locator(tid(Testids.seriesCelebration.confetti)).waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
    expect((await c.page.locator(tid(Testids.seriesCelebration.confetti)).count()) === 0, `${book}: expected the confetti to clear itself`);
    await click(c, tid(Testids.seriesCelebration.dismiss));
    await waitGone(c, tid(Testids.seriesCelebration.root), `${book} (dismiss)`);
  },
});

register({
  name: 'series-complete-reduced-motion',
  suite: 'p04',
  desc: 'With prefers-reduced-motion: completing Earthsea shows the celebration bubble but no falling bookmarks',
  async run(c) {
    await c.page.emulateMedia({ reducedMotion: 'reduce' });
    const book = await completeEarthsea(c);
    await c.page.waitForTimeout(800);
    const pieces = await c.page.locator(tid(Testids.seriesCelebration.confetti)).count();
    expect(pieces === 0, `${book}: expected no confetti with reduced motion, found ${pieces}`);
    await c.checkGates(`${book} (celebration, reduced motion)`);
    await c.snap('series-celebration-reduced-motion');
  },
});

register({
  name: 'series-merge',
  suite: 'p04',
  desc: 'Fixture "demo": put Good Omens in a new series "Disc World" #5 -> /series has 3 -> merge Disc World into Discworld after confirming -> 2 series, Discworld has 4 books',
  async run(c) {
    await openFixture(c, 'demo', '/');
    const path = await openBook(c, 'Good Omens');
    await click(c, tid(Testids.bookDetail.edit));
    await waitVisible(c, vis(tid(si.search)), `${path}/edit`);
    await fill(c, tid(si.search), 'Disc World');
    // "Disc World" is not "Discworld": the picker offers the real one and a new series.
    await waitVisible(c, vis(tid(si.create)), `${path}/edit (search)`);
    await click(c, tid(si.create));
    await waitForText(c, tid(si.status), 'A new series', `${path}/edit (new)`);
    await fill(c, tid(si.position), '5');
    await click(c, tid(Testids.bookForm.save));
    await waitForPath(c, path, `${path}/edit -> save`);
    await waitForText(c, tid(bs.place), 'Book 5', path);

    await c.goto('/series');
    await waitForCount(c, tid(Testids.seriesList.row), 3, '/series');
    const dup = await openSeries(c, 'Disc World');
    await click(c, tid(sd.more));
    await click(c, tid(sd.merge));
    const dialog = tid(Testids.dialog.root);
    await waitVisible(c, vis(dialog), `${dup} (merge)`);
    await c.page.locator(vis(`${tid(sd.mergeOption)}[aria-label^="Discworld,"]`)).click();
    await waitForText(c, dialog, 'Move 1 book into Discworld, keeping their numbers, and remove “Disc World”?', `${dup} (merge)`);
    await c.checkGates(`${dup} (merge dialog)`);
    await c.snap('series-merge-dialog');
    await click(c, tid(Testids.dialog.confirm));
    await c.page.waitForURL((u) => /^\/series\/\d+$/.test(u.pathname) && u.pathname !== dup, { timeout: 10_000 }).catch(() => {});
    const target = new URL(c.page.url()).pathname;
    expect(/^\/series\/\d+$/.test(target) && target !== dup, `${dup} -> merge: expected to land on Discworld's page, found ${q(target)}`);
    await waitForText(c, tid(sd.title), 'Discworld', target);
    expect((await count(c, tid(sd.book))) === 4, `${target}: expected 4 Discworld books after the merge`);

    await c.goto('/series');
    await waitForCount(c, tid(Testids.seriesList.row), 2, '/series (after merge)');
  },
});
