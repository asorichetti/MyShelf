// Phase 06: grouping, display modes, filters, preferences, genres, authors,
// user groups and the browse hub.
import { Testids, tid } from '../selectors.ts';
import { openFixture, rowNames, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const row = tid(Testids.home.row);
const sv = Testids.shelfView;
const g = Testids.groups;
const header = `${tid(sv.sectionHeader)} [role="heading"]`;

/** Section headers' spoken names ("Fantasy, 6 books"), top to bottom. */
async function sections(c: Context): Promise<string[]> {
  return c.page.locator(header).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') || ''));
}

/** Waits until the section headers read exactly `want`. */
async function waitForSections(c: Context, want: string[], where: string): Promise<void> {
  try {
    await c.page.waitForFunction(
      ([sel, w]) => JSON.stringify([...document.querySelectorAll(sel as string)].map((el) => el.getAttribute('aria-label'))) === JSON.stringify(w),
      [header, want] as const,
      { timeout: 10_000 },
    );
  } catch {
    expect(false, `${where}: expected sections ${q(want)}, found ${q(await sections(c))}`);
  }
}

async function groupBy(c: Context, option: string): Promise<void> {
  await c.page.locator(tid(sv.groupByButton)).click();
  await c.page.locator(tid(option)).click();
  await c.page.locator(tid(sv.groupByButton)).click();
}

/** Accessible names of elements matching `sel`. */
async function names(c: Context, sel: string): Promise<string[]> {
  return c.page.locator(sel).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') || (el as HTMLElement).innerText.trim()));
}

/** Waits for a snackbar whose text starts with `prefix` and returns its text. */
async function waitForSnack(c: Context, prefix: string, where: string): Promise<string> {
  const sel = tid(Testids.snackbar.root);
  try {
    await c.page.waitForFunction(([s, p]) => ((document.querySelector(s as string) as HTMLElement | null)?.innerText.trim() ?? '').startsWith(p as string), [sel, prefix] as const, {
      timeout: 10_000,
    });
  } catch {
    const found = (await c.page.locator(sel).count()) ? await c.page.locator(sel).innerText() : '(no snackbar)';
    expect(false, `${where}: expected a snackbar starting ${q(prefix)}, found ${q(found)}`);
  }
  return (await c.page.locator(sel).innerText()).trim();
}

register({
  name: 'shelf-group-by-genre',
  suite: 'p06',
  desc: 'Fixture "demo": group by genre shows 4 brass-edged sections with counts (a two-genre book in both); series sections are in reading order; None restores the flat list',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    const button = c.page.locator(tid(sv.groupByButton));
    expect((await button.getAttribute('aria-expanded')) === 'false', '/: the group-by button should start collapsed');
    await button.click();
    expect((await c.page.locator(tid(sv.groupByNone)).getAttribute('aria-checked')) === 'true', '/: expected "None" to be the current grouping');
    await c.page.locator(tid(sv.groupByGenre)).click();
    await waitForSections(c, ['Classics, 2 books', 'Fantasy, 6 books', 'Mystery, 3 books', 'Science Fiction, 2 books'], '/ group by genre');
    const visible = await c.page.locator(header).evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText.trim()));
    expect(visible[1] === 'Fantasy · 6', `/ group by genre: expected the visible header "Fantasy · 6", found ${q(visible[1])}`);
    // The Hound of the Baskervilles is both Mystery and Classics: 13 rows for 12 books.
    await waitForCount(c, row, 13, '/ group by genre');
    const summary = (await c.page.locator(tid(Testids.home.resultCount)).innerText()).trim();
    expect(summary === 'Showing all 12 books', `/ group by genre: the count should still be distinct books, found ${q(summary)}`);
    await c.checkGates('/ (grouped by genre)');
    await c.snap('group-by-genre');

    await c.page.locator(tid(sv.groupBySeries)).click();
    await waitForSections(c, ['Discworld, 3 books', 'Earthsea, 2 books', 'Not in a series, 7 books'], '/ group by series');
    const names3 = (await rowNames(c)).slice(0, 3).map((n) => n.split(',')[0]);
    expect(q(names3) === q(['The Colour of Magic', 'The Light Fantastic', 'Mort']), `/ group by series: expected Discworld in reading order, found ${q(names3)}`);
    await c.snap('group-by-series');

    await c.page.locator(tid(sv.groupByNone)).click();
    await waitForCount(c, header, 0, '/ group by none');
    await waitForCount(c, row, 12, '/ group by none');
  },
});

register({
  name: 'shelf-view-modes',
  suite: 'p06',
  desc: 'List -> Covers (3 columns of real covers) -> Spines (titled spines named in full); each mode passes the render gate (no sideways overflow) and keeps group-by sections',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await c.snap('mode-list');

    await c.page.locator(tid(sv.modeCovers)).click();
    await waitForCount(c, tid(sv.coverCell), 12, '/ covers');
    expect((await c.page.locator(tid(sv.modeCovers)).getAttribute('aria-checked')) === 'true', '/ covers: expected the Covers option to be checked');
    expect((await c.page.locator(row).count()) === 0, '/ covers: the list rows should be gone');
    const tops = await c.page.locator(tid(sv.coverCell)).evaluateAll((els) => els.slice(0, 4).map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(tops[0] === tops[1] && tops[1] === tops[2] && tops[3] > tops[0], `/ covers: expected 3 covers per row on a phone, found tops ${q(tops)}`);
    const cellNames = await names(c, tid(sv.coverCell));
    expect(cellNames.includes('Dune, by Frank Herbert, 1965, rated 4 out of 5, on loan to Sam'), `/ covers: expected cells named like list rows, found ${q(cellNames)}`);
    const images = await c.page.locator(`${tid(sv.coverCell)} ${tid(Testids.cover.image)}`).count();
    expect(images >= 10, `/ covers: expected real cover images front and centre, found ${images}`);
    await c.checkGates('/ (covers)');
    await c.snap('mode-covers');

    await c.page.locator(tid(sv.modeSpines)).click();
    await waitForCount(c, tid(sv.spine), 12, '/ spines');
    const spineNames = await names(c, tid(sv.spine));
    expect(spineNames.includes('Good Omens, by Terry Pratchett and Neil Gaiman, 1990, rated 5 out of 5'), `/ spines: expected each spine named in full, found ${q(spineNames)}`);
    const widths = await c.page.locator(tid(sv.spine)).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    expect(widths.every((w) => w >= 48), `/ spines: every spine should be at least 48 px wide, found ${q(widths)}`);
    await c.checkGates('/ (spines)');
    await c.snap('mode-spines');

    await groupBy(c, sv.groupByGenre);
    await waitForSections(c, ['Classics, 2 books', 'Fantasy, 6 books', 'Mystery, 3 books', 'Science Fiction, 2 books'], '/ spines by genre');
    await waitForCount(c, tid(sv.spine), 13, '/ spines by genre');
    await c.checkGates('/ (spines grouped)');
    await c.snap('mode-spines-grouped');

    await c.page.locator(tid(sv.modeList)).click();
    await waitForCount(c, row, 13, '/ back to list');
  },
});

register({
  name: 'shelf-filters',
  suite: 'p06',
  desc: 'Filter Fantasy + on loan -> two removable chips and "no books match"; removing one chip shows the 6 Fantasy books; Clear all restores 12',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await c.page.locator(tid(sv.filterButton)).click();
    await waitVisible(c, tid(sv.filterSheet), '/ filter sheet');
    await c.checkGates('/ (filter sheet)');
    await c.snap('filter-sheet');
    await c.page.locator(`${tid(sv.filterGenre)}[aria-label^="Fantasy,"]`).click();
    await c.page.locator(tid(sv.filterLoanOnLoan)).click();
    expect((await c.page.locator(tid(sv.filterLoanOnLoan)).getAttribute('aria-checked')) === 'true', '/ filters: expected "On loan" checked');
    await c.page.locator(tid(sv.filterDone)).click();
    await waitForCount(c, tid(sv.filterChip), 2, '/ filters');
    const chips = await c.page.locator(tid(sv.filterChip)).allInnerTexts();
    expect(chips.some((t) => t.includes('Fantasy')) && chips.some((t) => t.includes('On loan')), `/ filters: expected Fantasy and On loan chips, found ${q(chips)}`);
    await waitVisible(c, tid(Testids.home.noMatches), '/ filters (nothing matches)');
    const summary = (await c.page.locator(tid(Testids.home.resultCount)).innerText()).trim();
    expect(summary === 'No books match your filters', `/ filters: expected ${q('No books match your filters')}, found ${q(summary)}`);
    expect((await c.page.locator(tid(sv.filterButton)).innerText()).includes('Filter (2)'), '/ filters: the Filter button should count 2 filters');
    await c.checkGates('/ (filters, no matches)');
    await c.snap('filters-none');

    await c.page.locator(`${tid(sv.filterChipRemove)}[aria-label="Remove filter On loan"]`).click();
    await waitForCount(c, row, 6, '/ filter Fantasy');
    const fantasy = (await c.page.locator(tid(Testids.home.resultCount)).innerText()).trim();
    expect(fantasy === '6 of 12 books match your filters', `/ filter Fantasy: found ${q(fantasy)}`);
    await c.snap('filters-fantasy');

    await c.page.locator(tid(sv.filterClear)).click();
    await waitForCount(c, row, 12, '/ after Clear all');
    await waitForCount(c, tid(sv.filterChip), 0, '/ after Clear all');
  },
});

register({
  name: 'shelf-prefs-persist',
  suite: 'p06',
  desc: 'Group by author, Covers mode, sort by year and a Science Fiction filter all survive a reload',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await groupBy(c, sv.groupByAuthor);
    await c.page.locator(tid(sv.modeCovers)).click();
    await c.page.locator(tid(Testids.home.sortButton)).click();
    await c.page.locator(tid(Testids.home.sortYear)).click();
    await c.page.locator(tid(Testids.home.sortButton)).click();
    await c.page.locator(tid(sv.filterButton)).click();
    await c.page.locator(`${tid(sv.filterGenre)}[aria-label^="Science Fiction,"]`).click();
    await c.page.locator(tid(sv.filterDone)).click();
    await waitForSections(c, ['Frank Herbert, 1 book', 'Ursula K. Le Guin, 1 book'], '/ before reload');
    // Preferences are written a moment after the last change.
    await c.page.waitForTimeout(800);

    await c.page.reload();
    await waitForSections(c, ['Frank Herbert, 1 book', 'Ursula K. Le Guin, 1 book'], '/ after reload');
    await waitForCount(c, tid(sv.coverCell), 2, '/ after reload (covers)');
    expect((await c.page.locator(tid(sv.modeCovers)).getAttribute('aria-checked')) === 'true', '/ after reload: expected Covers to be kept');
    const chips = await c.page.locator(tid(sv.filterChip)).allInnerTexts();
    expect(chips.length === 1 && chips[0].includes('Science Fiction'), `/ after reload: expected the Science Fiction chip, found ${q(chips)}`);
    expect((await c.page.locator(tid(sv.groupByButton)).innerText()).includes('Author'), '/ after reload: expected "Group: Author"');
    expect((await c.page.locator(tid(Testids.home.sortButton)).innerText()).includes('Year'), '/ after reload: expected the year sort');
    await c.checkGates('/ (after reload)');
    await c.snap('prefs-after-reload');
  },
});

register({
  name: 'browse-hub',
  suite: 'p06',
  desc: 'The Browse chips open Genres, Series, Authors and Groups (each with one h1), and hide while searching',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await c.snap('browse-hub');
    const targets: [string, string, string][] = [
      [sv.browseGenres, '/genres', 'Genres'],
      [sv.browseSeries, '/series', 'Series'],
      [sv.browseAuthors, '/authors', 'Authors'],
      [sv.browseGroups, '/groups', 'Groups'],
    ];
    for (const [chip, path, h1] of targets) {
      await c.page.locator(tid(chip)).click();
      await waitForPath(c, path, `/ -> ${h1}`);
      const heading = c.page.locator('[role="heading"][aria-level="1"]:visible, h1:visible');
      await heading.first().waitFor();
      const text = (await heading.first().innerText()).trim();
      expect(text === h1, `${path}: expected the h1 ${q(h1)}, found ${q(text)}`);
      await c.checkGates(path);
      await c.snap(`browse-${h1.toLowerCase()}`);
      if (path === '/groups') await c.page.locator(tid(Testids.tabs.shelf)).click();
      else await c.page.goBack();
      await waitForPath(c, '/', `${path} -> back`);
      await waitForCount(c, row, 12, `/ after ${h1}`);
    }
    await c.page.locator(tid(Testids.home.search)).fill('dune');
    await waitForCount(c, tid(sv.browse), 0, '/ while searching');
    await c.page.locator(tid(Testids.home.searchClear)).click();
    await waitVisible(c, tid(sv.browse), '/ after clearing the search');
  },
});

register({
  name: 'group-create-add-books',
  suite: 'p06',
  desc: 'Groups tab -> new group "Favourites" (Heart, Lavender) -> Shelf: Select 3 books -> Add to group -> the group shows 3, and the book detail lists it',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await c.page.locator(tid(Testids.tabs.groups)).click();
    await waitForPath(c, '/groups', 'tab Groups');
    await waitForCount(c, tid(g.card), 1, '/groups');
    await c.page.locator(tid(g.new)).first().click();
    await waitVisible(c, tid(g.editorSheet), '/groups new group');
    await c.page.locator(tid(g.editorName)).fill('Favourites');
    await c.page.locator(`${tid(g.editorIcon)}[aria-label="Heart icon"]`).click();
    await c.page.locator(`${tid(g.editorSwatch)}[aria-label="Lavender"]`).click();
    expect((await c.page.locator(`${tid(g.editorIcon)}[aria-label="Heart icon"]`).getAttribute('aria-checked')) === 'true', '/groups editor: Heart should be checked');
    await c.checkGates('/groups (new group sheet)');
    await c.snap('group-editor');
    await c.page.locator(tid(g.editorSave)).click();
    await waitForCount(c, tid(g.card), 2, '/groups after create');
    const cards = await names(c, tid(g.card));
    expect(cards.includes('Favourites, 0 books'), `/groups: expected the new card "Favourites, 0 books", found ${q(cards)}`);

    await c.page.locator(tid(Testids.tabs.shelf)).click();
    await waitForCount(c, row, 12, '/');
    await c.page.locator(tid(sv.selectButton)).click();
    await waitVisible(c, tid(Testids.selection.bar), '/ selecting');
    for (const title of ['Dune', 'Mort', 'Pride and Prejudice']) await c.page.locator(`${row}[aria-label^="${title},"]`).click();
    const checked = await c.page.locator(`${row}[aria-checked="true"]`).count();
    expect(checked === 3, `/ selecting: expected 3 checked rows, found ${checked}`);
    const count = (await c.page.locator(tid(Testids.selection.count)).innerText()).trim();
    expect(count === '3 books selected', `/ selecting: expected "3 books selected", found ${q(count)}`);
    await c.checkGates('/ (selecting)');
    await c.snap('selecting');
    await c.page.locator(tid(Testids.selection.addToGroup)).click();
    await waitVisible(c, tid(g.pickerSheet), '/ group picker');
    await c.snap('group-picker');
    await c.page.locator(`${tid(g.pickerOption)}[aria-label^="Favourites,"]`).click();
    await waitForSnack(c, 'Added 3 books to Favourites', '/ after adding');
    await waitForCount(c, tid(Testids.selection.bar), 0, '/ selection ends after adding');

    await c.page.locator(tid(Testids.tabs.groups)).click();
    await waitForPath(c, '/groups', 'tab Groups again');
    await c.page.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((el) => el.getAttribute('aria-label') === 'Favourites, 3 books'), tid(g.card));
    await c.checkGates('/groups (with Favourites)');
    await c.snap('groups-tab');
    await c.page.locator(`${tid(g.card)}[aria-label="Favourites, 3 books"]`).click();
    const path = await waitForPath(c, /^\/group\/\d+$/, '/groups -> Favourites');
    await waitForCount(c, row, 3, path);
    const inGroup = (await rowNames(c)).map((n) => n.split(',')[0]);
    expect(q(inGroup) === q(['Dune', 'Mort', 'Pride and Prejudice']), `${path}: expected the books in the order added, found ${q(inGroup)}`);
    await c.checkGates(path);
    await c.snap('group-detail');

    await c.page.locator(`${row}[aria-label^="Dune,"]`).click();
    await waitForPath(c, /^\/book\/\d+$/, `${path} -> Dune`);
    await waitVisible(c, tid(g.bookChips), '/book (groups)');
    const bookGroups = await c.page.locator(tid(g.bookChips)).innerText();
    expect(bookGroups.includes('Favourites'), `/book: expected the Favourites chip, found ${q(bookGroups)}`);
    await c.page.locator(tid(g.bookAdd)).click();
    await c.page.locator(`${tid(g.pickerOption)}[aria-label^="Holiday reads,"]`).click();
    await c.page.waitForFunction((sel) => (document.querySelector(sel) as HTMLElement | null)?.innerText.includes('Holiday reads'), tid(g.bookChips));
    await c.checkGates('/book (added to a second group)');
  },
});

register({
  name: 'group-reorder',
  suite: 'p06',
  desc: 'Holiday reads -> Reorder -> move the last book up twice (once by keyboard, keeping focus) -> the order survives a reload; Add books opens the Shelf picking for the group',
  async run(c) {
    await openFixture(c, 'demo', '/groups');
    await c.page.locator(`${tid(g.card)}[aria-label^="Holiday reads,"]`).click();
    const path = await waitForPath(c, /^\/group\/\d+$/, '/groups -> Holiday reads');
    await waitForCount(c, row, 3, path);
    const before = (await rowNames(c)).map((n) => n.split(',')[0]);
    expect(q(before) === q(['Good Omens', 'Murder on the Orient Express', 'Pride and Prejudice']), `${path}: unexpected starting order ${q(before)}`);

    await c.page.locator(tid(g.reorder)).click();
    await waitForCount(c, tid(g.reorderRow), 3, `${path} reorder`);
    const up = c.page.locator(`${tid(g.moveUp)}[aria-label="Move Pride and Prejudice up"]`);
    // First move by keyboard: focus the button and press Enter; focus must stay with the book.
    await up.focus();
    await c.page.keyboard.press('Enter');
    await c.page.waitForFunction((sel) => document.querySelectorAll(sel)[1]?.getAttribute('aria-label') === '2. Pride and Prejudice', tid(g.reorderRow));
    await c.settle();
    await c.settle();
    const focused = await c.page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
    expect(focused === 'Move Pride and Prejudice up', `${path}: expected focus to stay on "Move Pride and Prejudice up", found ${q(focused)}`);
    const status = await c.page.locator('[role="status"]').first().innerText();
    expect(status.includes('Pride and Prejudice moved to 2 of 3'), `${path}: expected the move to be announced, found ${q(status)}`);
    await up.click();
    await c.page.waitForFunction((sel) => document.querySelectorAll(sel)[0]?.getAttribute('aria-label') === '1. Pride and Prejudice', tid(g.reorderRow));
    expect(await c.page.locator(`${tid(g.moveUp)}[aria-label="Move Pride and Prejudice up"]`).isDisabled().catch(() => false) || (await c.page.locator(`${tid(g.moveUp)}[aria-label="Move Pride and Prejudice up"]`).getAttribute('aria-disabled')) === 'true', `${path}: the first book's Move up should be disabled`);
    await c.checkGates(`${path} (reordering)`);
    await c.snap('reorder');
    await c.page.locator(tid(g.reorderDone)).click();

    await c.page.reload();
    await waitForCount(c, row, 3, `${path} after reload`);
    const after = (await rowNames(c)).map((n) => n.split(',')[0]);
    expect(q(after) === q(['Pride and Prejudice', 'Good Omens', 'Murder on the Orient Express']), `${path} after reload: expected the new order, found ${q(after)}`);

    // Add books: the Shelf opens picking books for this group.
    await c.page.locator(tid(g.addBooks)).first().click();
    await waitForPath(c, '/', `${path} -> Add books`);
    await waitVisible(c, tid(Testids.selection.bar), '/ (adding to Holiday reads)');
    const add = c.page.locator(tid(Testids.selection.addToGroup));
    await c.page
      .waitForFunction((sel) => (document.querySelector(sel) as HTMLElement | null)?.innerText.includes('Add to Holiday reads'), tid(Testids.selection.addToGroup), { timeout: 10_000 })
      .catch(async () => expect(false, `/: expected "Add to Holiday reads", found ${q(await add.innerText())}`));
    await c.page.locator(`${row}[aria-label^="Mort,"]`).click();
    await add.click();
    await waitForPath(c, /^\/group\/\d+$/, '/ -> back to the group');
    await waitForCount(c, row, 4, `${path} after adding Mort`);
    const last = (await rowNames(c)).at(-1) ?? '';
    expect(last.startsWith('Mort,'), `${path}: expected Mort added at the end, found ${q(last)}`);
  },
});

register({
  name: 'genre-merge',
  suite: 'p06',
  desc: 'Tag Dune "Sci-Fi" instead of "Science Fiction", then rename Sci-Fi to "Science Fiction" on /genres -> merge prompt -> one Science Fiction genre with both books',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await c.page.locator(`${row}[aria-label^="Dune,"]`).click();
    await waitForPath(c, /^\/book\/\d+$/, '/ -> Dune');
    await c.page.locator(tid(Testids.bookDetail.edit)).click();
    await waitForPath(c, /^\/book\/\d+\/edit$/, 'Dune -> edit');
    await c.page.locator(`${tid(Testids.bookForm.genreChip)} [aria-label="Remove genre Science Fiction"], [aria-label="Remove genre Science Fiction"]`).first().click();
    await c.page.locator(tid(Testids.bookForm.genreInput)).fill('Sci-Fi');
    await c.page.locator(tid(Testids.bookForm.genreInput)).press('Enter');
    await c.page.locator(tid(Testids.bookForm.save)).click();
    await waitForPath(c, /^\/book\/\d+$/, 'edit -> save');

    await c.goto('/genres');
    await waitForCount(c, tid(Testids.genres.row), 5, '/genres');
    const list = await names(c, tid(Testids.genres.row));
    expect(list.includes('Sci-Fi, 1 book') && list.includes('Science Fiction, 1 book'), `/genres: expected Sci-Fi and Science Fiction with 1 book each, found ${q(list)}`);
    await c.snap('genres-before');
    await c.page.locator(`${tid(Testids.genres.rename)}[aria-label="Rename Sci-Fi"]`).click();
    await c.page.locator(tid(Testids.genres.renameInput)).fill('Science Fiction');
    await c.page.locator(tid(Testids.genres.renameSave)).click();
    await waitVisible(c, tid(Testids.dialog.root), '/genres merge prompt');
    const prompt = await c.page.locator(tid(Testids.dialog.root)).innerText();
    expect(prompt.includes('Merge into “Science Fiction”?') && prompt.includes('already a genre'), `/genres: expected the merge prompt, found ${q(prompt)}`);
    await c.checkGates('/genres (merge prompt)');
    await c.snap('genre-merge-prompt');
    await c.page.locator(tid(Testids.dialog.confirm)).click();
    await waitForCount(c, tid(Testids.genres.row), 4, '/genres after merge');
    const merged = await names(c, tid(Testids.genres.row));
    expect(merged.includes('Science Fiction, 2 books') && !merged.some((n) => n.startsWith('Sci-Fi')), `/genres: expected one Science Fiction with 2 books, found ${q(merged)}`);
    await c.checkGates('/genres (after merge)');
    await c.snap('genres-after');

    await c.page.locator(`${tid(Testids.genres.row)}[aria-label="Science Fiction, 2 books"]`).click();
    await waitForPath(c, /^\/genres\/\d+$/, '/genres -> Science Fiction');
    await waitForCount(c, row, 2, '/genres/[id]');
    await c.checkGates('/genres/[id]');
  },
});

register({
  name: 'author-browse',
  suite: 'p06',
  desc: '/authors -> letter P -> Terry Pratchett -> books grouped by series (Discworld, in reading order) then standalone',
  async run(c) {
    await openFixture(c, 'demo', '/authors');
    await waitForCount(c, tid(Testids.authors.row), 7, '/authors');
    const letters = await names(c, tid(Testids.authors.letter));
    expect(q(letters) === q(['Jump to A', 'Jump to C', 'Jump to D', 'Jump to G', 'Jump to H', 'Jump to L', 'Jump to P']), `/authors: unexpected letter index ${q(letters)}`);
    await c.snap('authors');
    await c.page.locator(`${tid(Testids.authors.letter)}[aria-label="Jump to P"]`).click();
    const pratchett = c.page.locator(`${tid(Testids.authors.row)}[aria-label="Terry Pratchett, 4 books"]`);
    expect(await pratchett.isVisible(), '/authors: after "P", Terry Pratchett should be in view');
    await pratchett.click();
    const path = await waitForPath(c, /^\/authors\/\d+$/, '/authors -> Pratchett');
    await waitVisible(c, tid(Testids.authors.detailTitle), path);
    await waitForSections(c, ['Discworld, 3 books', 'Standalone, 1 book'], path);
    const titles = (await rowNames(c)).map((n) => n.split(',')[0]);
    expect(q(titles) === q(['The Colour of Magic', 'The Light Fantastic', 'Mort', 'Good Omens']), `${path}: expected Discworld in order then Good Omens, found ${q(titles)}`);
    await c.checkGates(path);
    await c.snap('author-detail');
  },
});
