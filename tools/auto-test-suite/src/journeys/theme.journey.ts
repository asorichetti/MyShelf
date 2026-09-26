import { Testids, tid } from '../selectors.ts';
import { darkColors, lightColors } from '../themeTokens.ts';
import { openFixture, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

register({
  name: 'theme-tokens',
  suite: 'p00',
  desc: 'The theme writes its --ms-* tokens onto :root, and the body background and font come from them',
  async run(c) {
    await c.goto('/');
    const got = await c.page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const token = (n: string) => root.getPropertyValue(n).trim();
      // Resolve the paper token the way the browser paints it (rgb(...)).
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--ms-color-paper)';
      document.body.appendChild(probe);
      const paperRgb = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const body = getComputedStyle(document.body);
      return {
        primary: token('--ms-color-primary'),
        paper: token('--ms-color-paper'),
        paperRgb,
        fontBody: token('--ms-font-body'),
        bodyBackground: body.backgroundColor,
        bodyFont: body.fontFamily,
      };
    });
    expect(got.primary.toUpperCase() === '#6B3FA8', `:root: expected --ms-color-primary ${q('#6B3FA8')}, found ${q(got.primary)}`);
    expect(got.paper !== '', ':root: --ms-color-paper is empty');
    expect(
      got.bodyBackground === got.paperRgb,
      `body: expected background ${q(got.paperRgb)} (--ms-color-paper ${got.paper}), found ${q(got.bodyBackground)}`,
    );
    expect(got.fontBody !== '', ':root: --ms-font-body is empty');
    const unquote = (s: string) => s.replace(/["']/g, '').trim();
    expect(
      unquote(got.bodyFont).startsWith(unquote(got.fontBody)),
      `body: expected font-family to start with --ms-font-body ${q(got.fontBody)}, found ${q(got.bodyFont)}`,
    );
  },
});

// ---- P09-02: the dark theme ----


/** "#1C1424" → "rgb(28, 20, 36)", the way the browser reports a computed colour. */
function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

interface ThemeState {
  theme: string | undefined;
  colorScheme: string;
  paperToken: string;
  body: string;
  /** Background of the visible page-state container (each screen paints its paper there). */
  screen: string | null;
  /** Text colour of the visible h1. */
  h1: string | null;
}

/** What the page shows now: the theme on :root, the body and the visible screen's paper, and its h1's colour. */
function themeState(c: Context): Promise<ThemeState> {
  return c.page.evaluate(
    ([content]) => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"]');
      };
      const root = document.documentElement;
      const screen = [...document.querySelectorAll(content as string)].find(visible);
      const h1 = [...document.querySelectorAll('h1, [role="heading"][aria-level="1"]')].find(visible);
      return {
        theme: root.dataset.theme,
        colorScheme: getComputedStyle(root).colorScheme,
        paperToken: getComputedStyle(root).getPropertyValue('--ms-color-paper').trim(),
        body: getComputedStyle(document.body).backgroundColor,
        screen: screen ? getComputedStyle(screen).backgroundColor : null,
        h1: h1 ? getComputedStyle(h1).color : null,
      };
    },
    [tid(Testids.pageState.content)] as const,
  );
}

/** Asserts the page is painted in `scheme`'s colours: tokens, body, the screen's paper and its h1. */
async function expectTheme(c: Context, scheme: 'light' | 'dark', where: string): Promise<void> {
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const other = scheme === 'dark' ? lightColors : darkColors;
  try {
    await c.page.waitForFunction((want) => document.documentElement.dataset.theme === want, scheme, { timeout: 10_000 });
  } catch {
    // Reported below with the whole state.
  }
  const s = await themeState(c);
  const want = { theme: scheme, colorScheme: scheme, paperToken: colors.paper.toUpperCase(), body: rgb(colors.paper), screen: rgb(colors.paper) };
  const got = { theme: s.theme, colorScheme: s.colorScheme, paperToken: s.paperToken.toUpperCase(), body: s.body, screen: s.screen };
  expect(JSON.stringify(got) === JSON.stringify(want), `${where}: expected the ${scheme} theme ${q(want)}, found ${q(got)}`);
  expect(s.body !== rgb(other.paper), `${where}: the body still has the other theme's paper ${q(s.body)}`);
  // Screen titles are in the theme's primary, a book's title in its ink.
  const inks = [rgb(colors.primary), rgb(colors.ink)];
  if (s.h1) expect(inks.includes(s.h1), `${where}: expected the h1 in ${scheme} primary or ink ${q(inks)}, found ${q(s.h1)}`);
}

/** Puts away a Booky tip that appeared by itself (the backup reminder after a reload), so it covers nothing. */
async function dismissTip(c: Context): Promise<void> {
  const bubble = c.page.locator(tid(Testids.booky.bubble));
  if (await bubble.isVisible()) {
    await c.page.locator(tid(Testids.booky.dismiss)).first().click();
    await bubble.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }
}

/** Opens a screen by clicking, then runs the page gates and saves a screenshot. */
async function visit(c: Context, click: string, path: RegExp | string, name: string): Promise<void> {
  await c.page.locator(click).first().click();
  const at = await waitForPath(c, path, name);
  await c.checkGates(`${at} (dark)`);
  await expectTheme(c, 'dark', at);
  await c.snap(`dark-${name}`);
}

register({
  name: 'theme-dark-follows-system',
  suite: 'p09',
  desc: 'With the Appearance setting on System, the app follows prefers-color-scheme live: light tokens, then the dark ones on :root, body and screen when the system turns dark, and back',
  async run(c) {
    await c.page.emulateMedia({ colorScheme: 'light' });
    await openFixture(c, 'demo', '/');
    await expectTheme(c, 'light', '/ (system light)');
    await c.page.emulateMedia({ colorScheme: 'dark' });
    await expectTheme(c, 'dark', '/ (system turned dark)');
    await c.checkGates('/ (system dark)');
    const primary = await c.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ms-color-primary').trim());
    expect(primary.toUpperCase() === darkColors.primary.toUpperCase(), `/: expected --ms-color-primary ${q(darkColors.primary)} in the dark, found ${q(primary)}`);
    await c.snap('system-dark');
    await c.page.emulateMedia({ colorScheme: 'light' });
    await expectTheme(c, 'light', '/ (system back to light)');
  },
});

register({
  name: 'theme-dark-gallery',
  suite: 'p09',
  desc: 'Dark system scheme, fixture "demo": the Shelf, a Booky tip, book detail, the edit form, Loans, Groups, Settings and Preferences each paint dark tokens and pass the page gates; fixture "empty" shows Booky in the dark; a screenshot of each',
  async run(c) {
    await c.page.emulateMedia({ colorScheme: 'dark' });
    await openFixture(c, 'demo', '/');
    await expectTheme(c, 'dark', '/');
    await c.snap('dark-shelf');

    // Booky's help tip, open, in the dark.
    await c.page.locator(tid(Testids.booky.helpButton)).first().click();
    await waitVisible(c, tid(Testids.booky.bubble), '/ help tip');
    await c.checkGates('/ (dark, Booky tip open)');
    await c.snap('dark-booky-tip');
    await c.page.locator(tid(Testids.booky.dismiss)).first().click();

    await visit(c, `${tid(Testids.home.row)}[aria-label^="Dune,"]`, /^\/book\/\d+$/, 'book-detail');
    await visit(c, tid(Testids.bookDetail.edit), /^\/book\/\d+\/edit$/, 'book-form');
    await c.page.locator(tid(Testids.bookForm.cancel)).click();
    await waitForPath(c, /^\/book\/\d+$/, 'edit -> cancel');
    await c.page.locator(tid(Testids.bookDetail.back)).click();
    await waitForPath(c, '/', 'book -> back');
    await visit(c, tid(Testids.tabs.loans), '/loans', 'loans');
    await visit(c, tid(Testids.tabs.groups), '/groups', 'groups');
    await visit(c, tid(Testids.tabs.settings), '/settings', 'settings');
    await visit(c, tid(Testids.settings.preferences), '/settings/preferences', 'preferences');
    const system = c.page.locator(tid(Testids.themeSetting.system));
    await system.scrollIntoViewIfNeeded();
    expect((await system.getAttribute('aria-checked')) === 'true', '/settings/preferences: expected Appearance "Same as my phone" chosen by default');
    await c.snap('dark-preferences-appearance');

    // Booky on the empty Shelf.
    await openFixture(c, 'empty', '/');
    await waitVisible(c, tid(Testids.booky.avatar), '/ (empty, dark)');
    await expectTheme(c, 'dark', '/ (empty)');
    await c.snap('dark-empty-shelf');
  },
});

register({
  name: 'theme-setting-persist',
  suite: 'p09',
  desc: 'Light system scheme: Settings → Shelf and lending → Appearance Dark turns the app dark at once; read back from the database and after a reload it is still dark; System brings the light theme back',
  async run(c) {
    await c.page.emulateMedia({ colorScheme: 'light' });
    await openFixture(c, 'demo', '/settings/preferences');
    await expectTheme(c, 'light', '/settings/preferences');
    const dark = c.page.locator(tid(Testids.themeSetting.dark));
    await dark.scrollIntoViewIfNeeded();
    await dark.click();
    await expectTheme(c, 'dark', '/settings/preferences (Dark chosen)');
    expect((await dark.getAttribute('aria-checked')) === 'true', '/settings/preferences: expected Dark to be checked');
    await c.checkGates('/settings/preferences (dark)');

    // The choice saves in the background. Reopen the screen from the Shelf so it reads the
    // settings back from the database (the read queues behind the save) before reloading.
    await c.page.locator(tid(Testids.preferences.back)).click();
    await waitForPath(c, '/settings', 'preferences -> back');
    await c.page.locator(tid(Testids.tabs.shelf)).click();
    await waitForPath(c, '/', '/settings -> Shelf');
    await c.page.locator(tid(Testids.tabs.settings)).click();
    await waitForPath(c, '/settings', '/ -> Settings');
    await c.page.locator(tid(Testids.settings.preferences)).click();
    await waitForPath(c, '/settings/preferences', '/settings -> preferences');
    await c.page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('aria-checked') === 'true', tid(Testids.themeSetting.dark), { timeout: 10_000 }).catch(() => {});
    expect((await c.page.locator(tid(Testids.themeSetting.dark)).getAttribute('aria-checked')) === 'true', '/settings/preferences (reopened): expected Dark read back from the database');

    await c.page.reload();
    await waitVisible(c, tid(Testids.themeSetting.root), '/settings/preferences after reload');
    await expectTheme(c, 'dark', '/settings/preferences after reload (system still light)');
    await c.snap('preferences-dark-after-reload');
    await dismissTip(c);

    const system = c.page.locator(tid(Testids.themeSetting.system));
    await system.scrollIntoViewIfNeeded();
    await system.click();
    await expectTheme(c, 'light', '/settings/preferences (System chosen)');
  },
});
