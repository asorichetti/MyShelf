import { Testids, tid } from '../selectors.ts';
import { coverState, openFixture, rowNames, waitForCount, waitVisible } from './helpers.ts';
import { expect, q, register } from './registry.ts';

const row = tid(Testids.home.row);

register({
  name: 'shelf-empty',
  suite: 'core',
  desc: 'Fixture "empty": the Shelf shows its empty state with Booky, the message, and Scan and Add manually actions; no rows',
  async run(c) {
    await openFixture(c, 'empty', '/');
    const empty = tid(Testids.emptyState.root);
    await waitVisible(c, empty, '/ (empty)');
    const text = await c.page.locator(empty).innerText();
    expect(text.includes('Your shelf is empty'), `/ (empty): expected the title "Your shelf is empty" in ${empty}, found ${q(text)}`);
    expect(/fill in the title, author, genre and series/.test(text), `/ (empty): expected Booky's message in ${empty}, found ${q(text)}`);
    const booky = c.page.locator(empty).locator(tid(Testids.booky.avatar));
    expect(await booky.isVisible(), `/ (empty): expected Booky ${tid(Testids.booky.avatar)} in the empty state`);
    for (const id of [Testids.home.scanAction, Testids.home.addButton]) {
      expect(await c.page.locator(tid(id)).isVisible(), `/ (empty): expected the action ${tid(id)}`);
    }
    expect((await c.page.locator(row).count()) === 0, `/ (empty): expected no ${row}`);
    expect((await c.page.locator(tid(Testids.home.search)).count()) === 0, '/ (empty): an empty shelf should not offer a search box');
    await c.snap('shelf-empty');
  },
});

register({
  name: 'shelf-demo-list',
  suite: 'core',
  desc: 'Fixture "demo": 12 catalogue-card rows, each a button named "Title, by Author, Year" (rated and on-loan books say so), with the count stamp and live result count',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/ (demo)');
    const names = await rowNames(c);
    expect(names[0] === 'The Colour of Magic, by Terry Pratchett, 1983, rated 4 out of 5', `/ (demo): expected the first row ${q('The Colour of Magic, by Terry Pratchett, 1983, rated 4 out of 5')}, found ${q(names[0])}`);
    const unnamed = names.filter((n) => !/^.+, by .+, \d{4}/.test(n));
    expect(unnamed.length === 0, `/ (demo): rows without a "Title, by Author, Year" name: ${q(unnamed)}`);
    expect(names.includes('Dune, by Frank Herbert, 1965, rated 4 out of 5, on loan to Sam'), `/ (demo): expected Dune's row to say it is on loan, rows are ${q(names)}`);
    const roles = await c.page.locator(row).evaluateAll((els) => els.map((el) => el.getAttribute('role')));
    expect(roles.every((r) => r === 'button'), `/ (demo): expected every row to be a button, found roles ${q(roles)}`);
    const count = (await c.page.locator(tid(Testids.home.bookCount)).innerText()).trim();
    expect(/^12 books catalogued$/i.test(count), `/ (demo): expected the stamp "12 books catalogued", found ${q(count)}`);
    const status = c.page.locator(tid(Testids.home.resultCount));
    expect((await status.getAttribute('aria-live')) === 'polite', `/ (demo): expected ${tid(Testids.home.resultCount)} to be a polite live region`);

    // Real covers are the golden path: the rows on screen show real images, and
    // only the book without a cover shows the generated one.
    for (const title of ['The Colour of Magic', 'Dune', 'Good Omens']) {
      const cover = await coverState(c, `${row}[aria-label^="${title},"]`);
      expect(cover.images === 1 && cover.loaded === 1 && cover.fallbacks === 0, `/ (demo): expected ${q(title)} to show its real cover, found ${q(cover)}`);
    }
    const none = await coverState(c, `${row}[aria-label^="The Farthest Shore,"]`);
    expect(none.images === 0 && none.fallbacks === 1, `/ (demo): expected the generated cover for a book without one, found ${q(none)}`);
    await c.page.locator(row).first().scrollIntoViewIfNeeded();
    await c.snap('shelf-demo');
  },
});

register({
  name: 'shelf-search-sort',
  suite: 'p01',
  desc: 'Search "prat" shows only Pratchett and announces the count; clear restores 12; sort by year re-orders and survives a reload',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    await c.page.locator(tid(Testids.home.search)).fill('prat');
    await waitForCount(c, row, 4, '/ search "prat"');
    const names = await rowNames(c);
    expect(names.every((n) => n.includes('Terry Pratchett')), `/ search "prat": expected only Pratchett's books, found ${q(names)}`);
    const status = (await c.page.locator(tid(Testids.home.resultCount)).innerText()).trim();
    expect(status === '4 of 12 books match “prat”', `/ search "prat": expected the live count ${q('4 of 12 books match “prat”')}, found ${q(status)}`);
    await c.checkGates('/ (search "prat")');
    await c.snap('search-prat');

    await c.page.locator(tid(Testids.home.searchClear)).click();
    await waitForCount(c, row, 12, '/ after clearing the search');

    const sortButton = c.page.locator(tid(Testids.home.sortButton));
    expect((await sortButton.getAttribute('aria-expanded')) === 'false', '/: the sort button should start collapsed');
    await sortButton.click();
    await waitVisible(c, tid(Testids.sortSheet.root), '/ (Sort sheet)');
    expect((await sortButton.getAttribute('aria-expanded')) === 'true', '/: the sort button should report the open sheet (aria-expanded="true")');
    await c.page.getByRole('button', { name: 'Sort by: Title. Change' }).click();
    await c.page.locator(`${tid(Testids.sortSheet.levelKeyOption)}[aria-label="Year published"]`).click();
    await c.page.waitForFunction((sel) => (document.querySelector(sel)?.getAttribute('aria-label') || '').startsWith('Pride and Prejudice'), row);
    await c.checkGates('/ (sort sheet open)');
    await c.snap('sort-year');
    await c.page.locator(tid(Testids.sortSheet.done)).click();

    // The sort is a setting: it must survive a reload. Settings reads it back first, so the save has landed.
    await c.page.locator(tid(Testids.tabs.settings)).click();
    await c.page.waitForFunction((sel) => /Year/.test((document.querySelector(sel) as HTMLElement | null)?.innerText ?? ''), tid(Testids.settings.preferences), { timeout: 10_000 });
    await c.page.reload();
    await c.page.locator(tid(Testids.tabs.shelf)).click();
    await waitForCount(c, row, 12, '/ after reload');
    const first = (await rowNames(c))[0];
    expect(first.startsWith('Pride and Prejudice'), `/ after reload: expected the year sort to be kept (Pride and Prejudice first), found ${q(first)}`);
    const label = await c.page.locator(tid(Testids.home.sortButton)).innerText();
    expect(label.includes('Year'), `/ after reload: expected the sort button to say Year, found ${q(label)}`);
  },
});
