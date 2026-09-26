// Phase 07 (P07-04): every empty state, with Booky and one clear action,
// screenshotted for review. Fixture "empty" (and "demo" for a search with no
// matches).
import { Testids, tid } from '../selectors.ts';
import { openFixture, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

/** Only the element on the screen showing now: a stack keeps the screens underneath in the DOM, hidden. */
const vis = (selector: string) => `${selector} >> visible=true`;

/** Checks the empty state in view: Booky (an image named for its expression) and at least one action, then gates and a screenshot. */
async function expectEmpty(c: Context, where: string, name: string, selector = tid(Testids.emptyState.root)): Promise<void> {
  await waitVisible(c, vis(selector), where);
  const empty = c.page.locator(vis(selector)).first();
  const booky = await empty.locator('[role="img"][aria-label^="Booky"]').count();
  expect(booky === 1, `${where}: expected one Booky in the empty state, found ${booky}`);
  const buttons = await empty.locator('button, [role="button"]').allInnerTexts();
  expect(buttons.length >= 1 && buttons.length <= 2, `${where}: expected one clear action (at most a quieter second), found ${q(buttons)}`);
  await c.checkGates(`${where} (empty)`);
  await c.snap(`empty-${name}`);
}

register({
  name: 'empty-states-gallery',
  suite: 'p07',
  desc: 'Fixture "empty": the Shelf, Loans (out and history), Groups, a new empty group, Series, Genres, Authors and the scan tray each show Booky with one clear action; fixture "demo": a search with no matches',
  async run(c) {
    await openFixture(c, 'empty', '/');
    await expectEmpty(c, '/', 'shelf');

    await c.goto('/loans');
    await expectEmpty(c, '/loans', 'loans-out');
    await c.page.locator(tid(Testids.loans.tabHistory)).click();
    await expectEmpty(c, '/loans (history)', 'loans-history');

    await c.goto('/groups');
    await expectEmpty(c, '/groups', 'groups');
    await c.page.locator(tid(Testids.groups.new)).first().click();
    await waitVisible(c, tid(Testids.groups.editorSheet), '/groups new group');
    await c.page.locator(tid(Testids.groups.editorName)).fill('Favourites');
    await c.page.locator(tid(Testids.groups.editorSave)).click();
    await waitForCount(c, tid(Testids.groups.card), 1, '/groups after create');
    await c.page.locator(tid(Testids.groups.card)).first().click();
    const group = await waitForPath(c, /^\/group\/\d+$/, '/groups -> Favourites');
    await expectEmpty(c, group, 'group-detail');

    await c.goto('/series');
    await expectEmpty(c, '/series', 'series', tid(Testids.seriesList.empty));
    await c.goto('/genres');
    await expectEmpty(c, '/genres', 'genres');
    await c.goto('/authors');
    await expectEmpty(c, '/authors', 'authors');
    await c.goto('/scan/review');
    await expectEmpty(c, '/scan/review', 'scan-tray');

    await openFixture(c, 'demo', '/');
    await waitForCount(c, tid(Testids.home.row), 12, '/ (demo)');
    await c.page.locator(tid(Testids.home.search)).fill('zzzz');
    await expectEmpty(c, '/ (search "zzzz")', 'search-no-matches', tid(Testids.home.noMatches));
  },
});
