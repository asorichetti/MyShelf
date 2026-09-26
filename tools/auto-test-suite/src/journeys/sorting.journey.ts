// Phase 11: the multi-level sort — presets, building a sort by keyboard,
// saved presets across a reload, Surprise me, grouping plus sorting, and the
// sheet in the dark.
import { Testids, tid } from '../selectors.ts';
import { openFixture, rowNames, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const row = tid(Testids.home.row);
const S = Testids.sortSheet;
const sheet = tid(S.root);
const header = `${tid(Testids.shelfView.sectionHeader)} [role="heading"]`;

/** The demo library in Library order: genre, author, series, number in series, title. */
const LIBRARY_ORDER = [
  'Pride and Prejudice',
  'The Hound of the Baskervilles',
  'A Wizard of Earthsea',
  'The Farthest Shore',
  'The Colour of Magic',
  'The Light Fantastic',
  'Mort',
  'Good Omens',
  'The Murder of Roger Ackroyd',
  'Murder on the Orient Express',
  'Dune',
  'The Left Hand of Darkness',
];

/** Row titles, top to bottom (a row's name is "Title, by …"). */
async function rowTitles(c: Context): Promise<string[]> {
  return (await rowNames(c)).map((n) => n.split(', by ')[0].split(', ')[0]);
}

/** Waits until the rows read exactly `want`, top to bottom. */
async function waitForOrder(c: Context, want: string[], where: string): Promise<void> {
  try {
    await c.page.waitForFunction(
      ([sel, w]) =>
        JSON.stringify([...document.querySelectorAll(sel as string)].map((el) => (el.getAttribute('aria-label') || '').split(', by ')[0].split(', ')[0])) === JSON.stringify(w),
      [row, want] as const,
      { timeout: 10_000 },
    );
  } catch {
    expect(false, `${where}: expected the rows ${q(want)}, found ${q(await rowTitles(c))}`);
  }
}

async function waitForText(c: Context, selector: string, want: string | RegExp, where: string): Promise<string> {
  try {
    await c.page.waitForFunction(
      ([sel, w, isRe]) => {
        const t = (document.querySelector(sel as string) as HTMLElement | null)?.innerText.trim() ?? '';
        return isRe ? new RegExp(w as string).test(t) : t === w;
      },
      [selector, want instanceof RegExp ? want.source : want, want instanceof RegExp] as const,
      { timeout: 10_000 },
    );
  } catch {
    const found = (await c.page.locator(selector).count()) ? await c.page.locator(selector).first().innerText() : '(missing)';
    expect(false, `${where}: expected ${selector} to read ${q(String(want))}, found ${q(found)}`);
  }
  return (await c.page.locator(selector).first().innerText()).trim();
}

async function openSheet(c: Context, where: string): Promise<void> {
  await c.page.locator(tid(Testids.home.sortButton)).click();
  await waitVisible(c, sheet, `${where} (Sort sheet)`);
}

async function closeSheet(c: Context, where: string): Promise<void> {
  await c.page.locator(tid(S.done)).click();
  try {
    await c.page.locator(sheet).waitFor({ state: 'detached', timeout: 5_000 });
  } catch {
    expect(false, `${where}: the Sort sheet did not close`);
  }
}

async function choosePreset(c: Context, name: string): Promise<void> {
  await c.page.locator(`${tid(S.preset)}[aria-label="${name}"]`).click();
}

/** Where keyboard focus is: its accessible name and test id. */
function focused(c: Context): Promise<{ name: string | null; testid: string | null }> {
  return c.page.evaluate(() => ({ name: document.activeElement?.getAttribute('aria-label') ?? null, testid: document.activeElement?.getAttribute('data-testid') ?? null }));
}

/** Presses Tab until the control named `name` (or with test id `testid`) has focus. */
async function tabTo(c: Context, target: { name?: string; testid?: string }, where: string, max = 80): Promise<void> {
  for (let i = 0; i < max; i++) {
    await c.page.keyboard.press('Tab');
    const f = await focused(c);
    if ((target.name && f.name === target.name) || (target.testid && f.testid === target.testid)) return;
  }
  expect(false, `${where}: ${q(target)} was not reached with Tab in ${max} presses (focus on ${q(await focused(c))})`);
}

async function expectFocusName(c: Context, name: string, where: string): Promise<void> {
  await c.page.waitForFunction((n) => document.activeElement?.getAttribute('aria-label') === n, name, { timeout: 5_000 }).catch(() => undefined);
  const f = await focused(c);
  expect(f.name === name, `${where}: expected focus on ${q(name)}, found ${q(f)}`);
}

register({
  name: 'sort-library-order',
  suite: 'p11',
  desc: 'Fixture "demo": the Sort sheet\'s "Library order" preset puts the 12 books in genre, author, series, number order (exact rows); the header says "Genre, then Author, then Series, then Number in series"',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    const button = c.page.locator(tid(Testids.home.sortButton));
    expect((await button.innerText()).includes('Sort: A–Z by title'), `/: expected the sort button to name the default preset, found ${q(await button.innerText())}`);
    await openSheet(c, '/');
    const checked = await c.page.locator(`${tid(S.preset)}[aria-checked="true"]`).getAttribute('aria-label');
    expect(checked === 'A–Z by title', `/ (Sort sheet): expected "A–Z by title" checked, found ${q(checked)}`);
    await choosePreset(c, 'Library order');
    await waitForOrder(c, LIBRARY_ORDER, '/ (Library order)');
    await waitForCount(c, tid(S.level), 4, '/ (Library order levels)');
    const levels = await c.page.locator(tid(S.level)).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(
      q(levels) === q(['Level 1: Sort by Genre, A to Z', 'Level 2: Then by Author, A to Z', 'Level 3: Then by Series, A to Z', 'Level 4: Then by Number in series, First to last']),
      `/ (Library order): expected four named levels, found ${q(levels)}`,
    );
    await c.checkGates('/ (Sort sheet, Library order)');
    await c.snap('sort-sheet-library');
    await closeSheet(c, '/ (Library order)');
    await waitForText(c, tid(Testids.home.sortSummary), 'Sorted by Genre, then Author, then Series, then Number in series', '/ (Library order)');
    expect((await button.innerText()).includes('Sort: Library order'), `/: expected "Sort: Library order", found ${q(await button.innerText())}`);
    await c.checkGates('/ (Library order)');
    await c.snap('shelf-library-order');
  },
});

register({
  name: 'sort-keyboard-three-levels',
  suite: 'p11',
  desc: 'Keyboard only: Enter opens the Sort sheet; Tab, Space and Enter build On loan, then Author (Z to A), then Year (newest first); Move up/down keep focus on the level being moved; Escape closes the sheet and the rows are in that exact order',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await tabTo(c, { testid: Testids.home.sortButton }, '/');
    await c.page.keyboard.press('Enter');
    await waitVisible(c, sheet, '/ (Enter on Sort)');

    // Level 1: On loan.
    await tabTo(c, { name: 'Sort by: Title. Change' }, '/ (Sort sheet)');
    await c.page.keyboard.press('Enter');
    await tabTo(c, { name: 'On loan' }, '/ (level 1 keys)');
    await c.page.keyboard.press(' ');
    await expectFocusName(c, 'Sort by: On loan. Change', '/ (level 1 chosen)');

    // Level 2: Author, Z to A.
    await tabTo(c, { testid: S.addLevel }, '/ (Sort sheet)');
    await c.page.keyboard.press('Enter');
    await tabTo(c, { name: 'Author' }, '/ (level 2 keys)');
    await c.page.keyboard.press(' ');
    await expectFocusName(c, 'Then by: Author. Change', '/ (level 2 chosen)');
    await c.page.keyboard.press('Tab');
    await expectFocusName(c, 'Author order: A to Z. Reverse', '/ (level 2 direction)');
    await c.page.keyboard.press('Enter');
    await expectFocusName(c, 'Author order: Z to A. Reverse', '/ (level 2 reversed)');

    // Level 3: Year published, newest first.
    await tabTo(c, { testid: S.addLevel }, '/ (Sort sheet)');
    await c.page.keyboard.press('Enter');
    await tabTo(c, { name: 'Year published' }, '/ (level 3 keys)');
    await c.page.keyboard.press(' ');
    await c.page.keyboard.press('Tab');
    await c.page.keyboard.press('Enter');
    await expectFocusName(c, 'Year published order: Newest first. Reverse', '/ (level 3 reversed)');

    // Moving a level keeps focus on it; at the top, on its other arrow.
    await tabTo(c, { name: 'Move Year published up' }, '/ (level 3)');
    await c.page.keyboard.press('Enter');
    await expectFocusName(c, 'Move Year published up', '/ (Year moved to level 2)');
    await c.page.keyboard.press('Enter');
    await expectFocusName(c, 'Move Year published down', '/ (Year moved to level 1)');
    await waitForText(c, tid(S.status), 'Year published moved to level 1 of 3', '/ (announced)');
    await c.page.keyboard.press('Enter');
    await c.page.keyboard.press('Enter');
    await expectFocusName(c, 'Move Year published up', '/ (Year back at level 3)');
    const levels = await c.page.locator(tid(S.level)).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(
      q(levels) === q(['Level 1: Sort by On loan, On loan first', 'Level 2: Then by Author, Z to A', 'Level 3: Then by Year published, Newest first']),
      `/ (Sort sheet): expected the three levels built, found ${q(levels)}`,
    );
    await c.checkGates('/ (Sort sheet, three levels)');
    await c.snap('sort-sheet-three-levels');

    await c.page.keyboard.press('Escape');
    await c.page.locator(sheet).waitFor({ state: 'detached', timeout: 5_000 });
    await waitForOrder(
      c,
      [
        // On loan: Herbert, then Christie (Z to A)
        'Dune',
        'The Murder of Roger Ackroyd',
        // At home, authors Z to A, each newest first
        'Good Omens',
        'Mort',
        'The Light Fantastic',
        'The Colour of Magic',
        'The Farthest Shore',
        'The Left Hand of Darkness',
        'A Wizard of Earthsea',
        'The Hound of the Baskervilles',
        'Murder on the Orient Express',
        'Pride and Prejudice',
      ],
      '/ (three-level sort)',
    );
    await waitForText(c, tid(Testids.home.sortSummary), 'Sorted by On loan, then Author (Z to A), then Year published (Newest first)', '/');
  },
});

register({
  name: 'sort-save-preset-reload',
  suite: 'p11',
  desc: 'Build "Page count, longest first", save it as the preset "Doorstops", switch away; Preferences lists the preset (read back from the database), a reload keeps it, and applying it from the Sort sheet orders the shelf longest first',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await openSheet(c, '/');
    await c.page.getByRole('button', { name: 'Sort by: Title. Change' }).click();
    await c.page.locator(`${tid(S.levelKeyOption)}[aria-label="Page count"]`).click();
    await c.page.getByRole('button', { name: 'Page count order: Shortest first. Reverse' }).click();
    await c.page.locator(tid(S.savePreset)).click();
    await c.page.locator(tid(S.presetName)).fill('Doorstops');
    await c.page.locator(tid(S.presetSave)).click();
    await waitForText(c, tid(S.status), 'Saved “Doorstops”', '/ (Sort sheet)');
    await waitVisible(c, tid(S.savedPreset), '/ (Your presets)');
    await c.snap('sort-sheet-saved-preset');
    await choosePreset(c, 'A–Z by title');
    await closeSheet(c, '/');

    // Read the preset back from the database before reloading: Preferences lists saved presets.
    await c.page.locator(tid(Testids.tabs.settings)).click();
    await waitForPath(c, '/settings', '/ -> Settings');
    await c.page.locator(tid(Testids.settings.preferences)).click();
    await waitForPath(c, '/settings/preferences', '/settings -> Shelf and lending');
    await c.page.locator(tid(Testids.settings.sort)).click();
    await waitVisible(c, 'role=radio[name="Doorstops"]', '/settings/preferences (sort list)');
    await c.page.keyboard.press('Escape');

    await c.page.reload();
    await waitVisible(c, tid(Testids.settings.sort), '/settings/preferences after reload');
    await c.goto('/');
    await waitForCount(c, row, 12, '/ after reload');
    await openSheet(c, '/ after reload');
    await c.page.getByRole('button', { name: 'Doorstops: Page count (Longest first)' }).click();
    await closeSheet(c, '/ after reload');
    await waitForOrder(
      c,
      [
        'Dune', // 896
        'Pride and Prejudice', // 480
        'The Left Hand of Darkness', // 304
        'Good Omens', // 288, then by title
        'The Murder of Roger Ackroyd', // 288
        'The Colour of Magic', // 285
        'Mort', // 272
        'The Hound of the Baskervilles', // 256
        'Murder on the Orient Express', // 256
        'The Light Fantastic', // 241
        'The Farthest Shore', // 223
        'A Wizard of Earthsea', // 205
      ],
      '/ (Doorstops)',
    );
    const label = await c.page.locator(tid(Testids.home.sortButton)).innerText();
    expect(label.includes('Sort: Doorstops'), `/ (Doorstops): expected the sort button to name the preset, found ${q(label)}`);
  },
});

register({
  name: 'sort-surprise-stable',
  suite: 'p11',
  desc: '"Surprise me" shuffles the shelf; the order stays the same after leaving the Shelf and after a reload (saved with its seed), and changes when "Shuffle again" is pressed',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    const before = await rowTitles(c);
    const beforeNames = JSON.stringify(await rowNames(c));
    await openSheet(c, '/');
    await choosePreset(c, 'Surprise me');
    await waitVisible(c, tid(S.reshuffle), '/ (Surprise me)');
    await closeSheet(c, '/');
    await c.page
      .waitForFunction(([sel, b]) => JSON.stringify([...document.querySelectorAll(sel as string)].map((el) => el.getAttribute('aria-label'))) !== b, [row, beforeNames] as const, { timeout: 10_000 })
      .catch(() => undefined);
    const shuffled = await rowTitles(c);
    expect(q(shuffled) !== q(before) && shuffled.length === 12, `/ (Surprise me): expected a new order of all 12 books, found ${q(shuffled)}`);
    await waitForText(c, tid(Testids.home.sortSummary), 'Sorted by Surprise me', '/ (Surprise me)');

    // Leave the Shelf; Settings reads the sort back from the database ("Surprise me · lend for …").
    await c.page.locator(tid(Testids.tabs.settings)).click();
    await waitForPath(c, '/settings', '/ -> Settings');
    await waitForText(c, tid(Testids.settings.preferences), /Surprise me/, '/settings (sort read back)');
    await c.page.locator(tid(Testids.tabs.shelf)).click();
    await waitForPath(c, '/', '/settings -> Shelf');
    await waitForOrder(c, shuffled, '/ (back on the Shelf)');

    await c.page.reload();
    await waitForCount(c, row, 12, '/ after reload');
    await waitForOrder(c, shuffled, '/ after reload');

    await openSheet(c, '/ after reload');
    await c.page.locator(tid(S.reshuffle)).click();
    await closeSheet(c, '/ after reload');
    try {
      await c.page.waitForFunction(
        ([sel, was]) => JSON.stringify([...document.querySelectorAll(sel as string)].map((el) => (el.getAttribute('aria-label') || '').split(', by ')[0].split(', ')[0])) !== was,
        [row, JSON.stringify(shuffled)] as const,
        { timeout: 10_000 },
      );
    } catch {
      expect(false, `/ (Shuffle again): expected a new order, still ${q(shuffled)}`);
    }
    await c.snap('shelf-surprise');
  },
});

register({
  name: 'sort-grouped-by-genre',
  suite: 'p11',
  desc: 'Grouped by genre with Library order: sections come A to Z and the sort applies inside each (Mystery: Christie, Christie, Conan Doyle); the summary and the sheet say genre orders the sections; Genre Z to A reverses them',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await c.page.locator(tid(Testids.shelfView.groupByButton)).click();
    await c.page.locator(tid(Testids.shelfView.groupByGenre)).click();
    await c.page.locator(tid(Testids.shelfView.groupByButton)).click();
    await openSheet(c, '/ (grouped)');
    await choosePreset(c, 'Library order');
    await waitVisible(c, tid(S.groupNote), '/ (Sort sheet, grouped)');
    const note = (await c.page.locator(tid(S.groupNote)).innerText()).trim();
    expect(note.startsWith('Grouped by genre: Genre orders the sections'), `/ (Sort sheet, grouped): expected the grouping note, found ${q(note)}`);
    await c.checkGates('/ (Sort sheet, grouped)');
    await closeSheet(c, '/ (grouped)');
    await waitForText(c, tid(Testids.home.sortSummary), 'Sorted by Genre (as sections), then Author, then Series, then Number in series', '/ (grouped)');
    const sections = await c.page.locator(header).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(q(sections) === q(['Classics, 2 books', 'Fantasy, 6 books', 'Mystery, 3 books', 'Science Fiction, 2 books']), `/ (grouped): expected four genre sections A to Z, found ${q(sections)}`);
    await waitForOrder(
      c,
      [
        'Pride and Prejudice',
        'The Hound of the Baskervilles',
        'A Wizard of Earthsea',
        'The Farthest Shore',
        'The Colour of Magic',
        'The Light Fantastic',
        'Mort',
        'Good Omens',
        'The Murder of Roger Ackroyd',
        'Murder on the Orient Express',
        'The Hound of the Baskervilles',
        'Dune',
        'The Left Hand of Darkness',
      ],
      '/ (grouped by genre, Library order)',
    );
    await c.checkGates('/ (grouped, Library order)');
    await c.snap('shelf-grouped-library');

    await openSheet(c, '/ (grouped)');
    await c.page.getByRole('button', { name: 'Genre order: A to Z. Reverse' }).click();
    await closeSheet(c, '/ (grouped)');
    try {
      await c.page.waitForFunction(
        (sel) => [...document.querySelectorAll(sel)].map((el) => el.getAttribute('aria-label'))[0] === 'Science Fiction, 2 books',
        header,
        { timeout: 10_000 },
      );
    } catch {
      expect(false, `/ (Genre Z to A): expected Science Fiction first, found ${q(await c.page.locator(header).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label'))))}`);
    }
    await waitForText(c, tid(Testids.home.sortSummary), 'Sorted by Genre (as sections, Z to A), then Author, then Series, then Number in series', '/ (Genre Z to A)');
  },
});

register({
  name: 'sort-sheet-dark',
  suite: 'p11',
  desc: 'In the dark theme the Sort sheet (presets, a saved preset, four levels) and a Library-ordered shelf pass the gates (contrast included); screenshots for review',
  async run(c) {
    await c.page.emulateMedia({ colorScheme: 'dark' });
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await openSheet(c, '/ (dark)');
    await choosePreset(c, 'By author');
    // A preset's own levels are already saved; one change makes a sort worth saving.
    expect((await c.page.locator(tid(S.savePreset)).getAttribute('aria-disabled')) === 'true', '/ (dark): expected "Save as preset" off for a built-in preset');
    await c.page.getByRole('button', { name: 'Year published order: Oldest first. Reverse' }).click();
    await c.page.locator(tid(S.savePreset)).click();
    await c.page.locator(tid(S.presetName)).fill('Author shelves');
    await c.page.locator(tid(S.presetSave)).click();
    await waitVisible(c, tid(S.savedPreset), '/ (dark, Your presets)');
    await choosePreset(c, 'Library order');
    await waitForOrder(c, LIBRARY_ORDER, '/ (dark, Library order)');
    const bg = await c.page.locator(sheet).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg !== 'rgb(255, 255, 255)', `/ (dark): expected a dark sheet, found background ${q(bg)}`);
    await c.checkGates('/ (Sort sheet, dark)');
    await c.snap('sort-sheet-dark');
    await closeSheet(c, '/ (dark)');
    await c.checkGates('/ (Library order, dark)');
    await c.snap('shelf-library-order-dark');
  },
});

register({
  name: 'sort-rainbow-spines',
  suite: 'p11',
  desc: 'Rainbow on the Spines view: every spine colour forms one run and the runs go round the colour wheel from red (the generated spine colours, not cover photos)',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await openSheet(c, '/');
    await choosePreset(c, 'Rainbow');
    await closeSheet(c, '/ (Rainbow)');
    await c.page.locator(tid(Testids.shelfView.modeSpines)).click();
    await waitForCount(c, tid(Testids.shelfView.spine), 12, '/ (spines)');
    const hues = await c.page.locator(tid(Testids.shelfView.spine)).evaluateAll((els) =>
      els.map((el) => {
        const [r, g, b] = (getComputedStyle(el).backgroundColor.match(/\d+/g) ?? []).map(Number).map((v) => v / 255);
        const max = Math.max(r, g, b);
        const d = max - Math.min(r, g, b);
        if (!d) return 0;
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return Math.round((h * 60 + 360) % 360);
      }),
    );
    const sorted = hues.every((h, i) => i === 0 || h >= hues[i - 1]);
    expect(sorted, `/ (Rainbow spines): expected spine hues round the wheel from red, found ${q(hues)}`);
    await c.checkGates('/ (Rainbow spines)');
    await c.snap('shelf-rainbow-spines');
  },
});
