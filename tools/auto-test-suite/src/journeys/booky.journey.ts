import { Testids, tid } from '../selectors.ts';
import { openFixture, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const emptyState = tid(Testids.emptyState.root);
const avatar = tid(Testids.booky.avatar);
const askBooky = tid(Testids.home.askBooky);
const bubble = tid(Testids.booky.bubble);
const bubbleText = tid(Testids.booky.bubbleText);
const dismiss = tid(Testids.booky.dismiss);

register({
  name: 'booky-empty-shelf',
  suite: 'core',
  desc: 'Booky shows in the empty Shelf; "What can Booky do?" opens a tip bubble that passes the page gates and the dismiss button closes',
  async run(c) {
    await c.goto('/');

    const booky = c.page.locator(emptyState).locator(avatar);
    expect((await booky.count()) === 1, `/: expected one ${avatar} inside ${emptyState}, found ${await booky.count()}`);
    expect(await booky.isVisible(), `/: ${avatar} is in the empty shelf but not visible`);
    const role = await booky.getAttribute('role');
    const label = (await booky.getAttribute('aria-label')) ?? '';
    expect(role === 'img' && label.startsWith('Booky'), `/: expected Booky as role=img with a "Booky..." label, found role=${q(role)} label=${q(label)}`);
    expect((await c.page.locator(bubble).count()) === 0, `/: expected no tip bubble ${bubble} before asking Booky`);

    await c.page.locator(askBooky).click();
    try {
      await c.page.locator(bubble).waitFor({ state: 'visible' });
    } catch (err) {
      expect(false, `/: tapping ${askBooky} did not open ${bubble}: ${(err as Error).message}`);
    }
    const text = (await c.page.locator(bubbleText).innerText()).trim();
    expect(text.length > 0, `/: expected text in ${bubbleText}, found ${q(text)}`);
    // The open bubble adds a dismiss button, a second Booky and a live region:
    // the page must still pass every page gate (target-size included).
    await c.checkGates('/ (Booky tip open)');
    await c.snap('booky-tip-open');

    await c.page.locator(dismiss).click();
    try {
      await c.page.locator(bubble).waitFor({ state: 'detached' });
    } catch (err) {
      expect(false, `/: tapping ${dismiss} did not close ${bubble}: ${(err as Error).message}`);
    }
    expect(await booky.isVisible(), `/: the empty-shelf Booky ${avatar} disappeared after dismissing the tip`);
  },
});

/** Only the element on the screen showing now: a stack keeps the screens underneath in the DOM, hidden. */
const vis = (selector: string) => `${selector} >> visible=true`;
const helpButton = tid(Testids.booky.helpButton);
const helpMore = tid(Testids.booky.helpMore);
const helpSheet = tid(Testids.booky.helpSheet);

/** Presses the screen's help button and checks Booky's help tip: thinking, with text and "More help". Returns the text. */
async function openHelp(c: Context, where: string): Promise<string> {
  await c.page.locator(vis(helpButton)).first().click();
  try {
    await c.page.locator(bubble).waitFor({ state: 'visible', timeout: 10_000 });
  } catch (err) {
    expect(false, `${where}: the help button did not open ${bubble}: ${(err as Error).message.split('\n')[0]}`);
  }
  const text = (await c.page.locator(bubbleText).innerText()).trim();
  expect(text.length > 0, `${where}: expected help text in ${bubbleText}, found ${q(text)}`);
  const face = (await c.page.locator(`${bubble} [role="img"]`).first().getAttribute('aria-label')) ?? '';
  expect(face === 'Booky the bookmark, thinking', `${where}: expected thinking Booky, found ${q(face)}`);
  expect((await c.page.locator(helpMore).count()) === 1, `${where}: expected a "More help" button ${helpMore}`);
  return text;
}

async function closed(c: Context, selector: string, where: string): Promise<void> {
  try {
    await c.page.locator(selector).waitFor({ state: 'detached', timeout: 10_000 });
  } catch (err) {
    expect(false, `${where}: ${selector} did not close: ${(err as Error).message.split('\n')[0]}`);
  }
}

const tabs = [
  { key: 'shelf', tab: Testids.tabs.shelf, root: Testids.home.root },
  { key: 'scan', tab: Testids.tabs.scan, root: Testids.scan.root },
  { key: 'loans', tab: Testids.tabs.loans, root: Testids.loans.root },
  { key: 'groups', tab: Testids.tabs.groups, root: Testids.groups.root },
  { key: 'settings', tab: Testids.tabs.settings, root: Testids.settings.root },
] as const;

register({
  name: 'booky-help-each-tab',
  suite: 'p07',
  desc: 'Fixture "demo": on every tab the "Help with this screen" button has thinking Booky explain the screen (a11y gate enforced with the bubble open), each tab in its own words, and the dismiss button closes it',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, tid(Testids.home.row), 12, '/');
    const seen = new Set<string>();
    for (const t of tabs) {
      const where = `tab ${t.key}`;
      await c.page.locator(tid(t.tab)).click();
      await waitVisible(c, tid(t.root), where);
      const text = await openHelp(c, where);
      expect(!seen.has(text), `${where}: expected help in this screen's own words, found the same text as another tab: ${q(text)}`);
      seen.add(text);
      await c.checkGates(`${where} (help open)`);
      await c.snap(`help-${t.key}`);
      await c.page.locator(dismiss).click();
      await closed(c, bubble, where);
    }
  },
});

register({
  name: 'booky-help-screens',
  suite: 'p07',
  desc: 'Help beyond the tabs: book detail, series detail and the edition picker each explain themselves, and "More help" opens the help sheet (a dialog) that "Got it" closes',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, tid(Testids.home.row), 12, '/');
    await c.page.locator(`${tid(Testids.home.row)}[aria-label^="Dune,"]`).click();
    const book = await waitForPath(c, /^\/book\/\d+$/, '/ -> Dune');
    await waitVisible(c, vis(tid(Testids.bookDetail.title)), book);
    await openHelp(c, book);
    await c.page.locator(helpMore).click();
    await waitVisible(c, helpSheet, `${book} -> More help`);
    const role = await c.page.locator(helpSheet).getAttribute('role');
    expect(role === 'dialog', `${book}: expected the help sheet to be a dialog, found role=${q(role)}`);
    const sheet = await c.page.locator(helpSheet).innerText();
    expect(sheet.includes('What is an edition?'), `${book}: expected the help sheet to explain editions, found ${q(sheet.slice(0, 200))}`);
    await c.checkGates(`${book} (help sheet)`);
    await c.snap('help-sheet-book');
    await c.page.locator(tid(Testids.booky.helpClose)).click();
    await closed(c, helpSheet, book);

    await c.goto('/series');
    await c.page.locator(vis(`${tid(Testids.seriesList.row)}[aria-label^="Discworld,"]`)).click();
    const series = await waitForPath(c, /^\/series\/\d+$/, '/series -> Discworld');
    await waitVisible(c, vis(tid(Testids.seriesDetail.title)), series);
    await openHelp(c, series);
    await c.checkGates(`${series} (help open)`);
    await c.snap('help-series');
    await c.page.locator(dismiss).click();
    await closed(c, bubble, series);

    await openFixture(c, 'empty', '/scan');
    await waitVisible(c, tid(Testids.scan.webIsbn), '/scan');
    await c.page.locator(tid(Testids.scan.webIsbn)).fill('9780552166591');
    await c.page.locator(tid(Testids.scan.webIsbnSubmit)).click();
    await waitForPath(c, '/scan/pick', '/scan -> lookup');
    await waitVisible(c, tid(Testids.picker.edition), '/scan/pick');
    await openHelp(c, '/scan/pick');
    await c.checkGates('/scan/pick (help open)');
    await c.snap('help-editions');
    await c.page.locator(helpMore).click();
    await waitVisible(c, helpSheet, '/scan/pick -> More help');
    await c.page.locator(tid(Testids.booky.helpClose)).click();
    await closed(c, helpSheet, '/scan/pick');
  },
});
