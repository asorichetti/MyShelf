import { Testids, tid } from '../selectors.ts';
import { expect, q, register, type Context } from './registry.ts';

// Each tab, the route it must land on, and the screen it must show.
const tabs = [
  { key: 'scan', tab: Testids.tabs.scan, path: '/scan', root: Testids.scan.root, title: Testids.scan.title, h1: 'Scan a book' },
  { key: 'loans', tab: Testids.tabs.loans, path: '/loans', root: Testids.loans.root, title: Testids.loans.title, h1: 'Loans' },
  { key: 'groups', tab: Testids.tabs.groups, path: '/groups', root: Testids.groups.root, title: Testids.groups.title, h1: 'Groups' },
  { key: 'settings', tab: Testids.tabs.settings, path: '/settings', root: Testids.settings.root, title: Testids.settings.title, h1: 'Settings' },
  // Shelf last, so clicking back to it is exercised too.
  { key: 'shelf', tab: Testids.tabs.shelf, path: '/', root: Testids.home.root, title: Testids.home.title, h1: 'MyShelf' },
] as const;

const allTabIds = tabs.map((t) => t.tab);

/** The visible level-1 headings: <h1> and role="heading" aria-level="1". */
async function visibleH1s(c: Context): Promise<{ testid: string; text: string }[]> {
  return c.page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('h1, [role="heading"][aria-level="1"]')]
      .filter((el) => !el.closest('[aria-hidden="true"], [inert]') && el.checkVisibility({ visibilityProperty: true }))
      .map((el) => ({ testid: el.getAttribute('data-testid') || '', text: el.innerText.trim() })),
  );
}

// The RN web tab bar renders each tab as <a role="tab" aria-selected>; it sets
// no aria-current, so aria-selected is the state that must follow the screen.
async function selectedState(c: Context): Promise<Record<string, string | null>> {
  return c.page.evaluate((ids) => {
    const out: Record<string, string | null> = {};
    for (const id of ids) {
      const el = document.querySelector('[data-testid="' + id + '"]');
      out[id] = el ? el.getAttribute('aria-selected') : 'missing';
    }
    return out;
  }, allTabIds as unknown as string[]);
}

async function expectBookyOnEmptyShelf(c: Context, where: string): Promise<void> {
  const empty = c.page.locator(tid(Testids.emptyState.root));
  expect(await empty.isVisible(), `${where}: expected the empty-shelf state ${tid(Testids.emptyState.root)} to be visible`);
  const booky = empty.locator('[role="img"][aria-label^="Booky"]');
  expect((await booky.count()) === 1, `${where}: expected one Booky illustration in the empty shelf, found ${await booky.count()}`);
  expect(await booky.isVisible(), `${where}: Booky is in the empty shelf but not visible`);
}

register({
  name: 'tabs-navigate',
  suite: 'core',
  desc: 'Each tab lands on its route with exactly one h1, aria-selected follows the active tab, and Booky shows on the empty Shelf',
  async run(c) {
    await c.goto('/');
    await expectBookyOnEmptyShelf(c, '/');

    for (const t of tabs) {
      const where = `tab ${t.key}`;
      await c.page.locator(tid(t.tab)).click();
      try {
        await c.page.locator(tid(t.root)).waitFor({ state: 'visible' });
      } catch (err) {
        expect(false, `${where}: screen ${tid(t.root)} never appeared: ${(err as Error).message}`);
      }
      const url = new URL(c.page.url());
      expect(url.pathname === t.path, `${where}: expected URL path ${q(t.path)}, found ${q(url.pathname)}`);

      const h1s = await visibleH1s(c);
      expect(h1s.length === 1, `${where}: expected exactly one visible h1, found ${h1s.length}: ${q(h1s.map((h) => h.text))}`);
      expect(
        h1s[0]!.testid === t.title && h1s[0]!.text === t.h1,
        `${where}: expected h1 ${q(t.h1)} (${t.title}), found ${q(h1s[0]!.text)} (${h1s[0]!.testid || 'no testid'})`,
      );

      const state = await selectedState(c);
      for (const id of allTabIds) {
        const want = id === t.tab ? 'true' : 'false';
        expect(state[id] === want, `${where}: expected ${tid(id)} aria-selected=${q(want)}, found ${q(state[id])}`);
      }

      await c.checkGates(t.path);
      await c.snap(`tab-${t.key}`);
    }

    await expectBookyOnEmptyShelf(c, 'tab shelf');
  },
});
