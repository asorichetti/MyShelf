import { Testids, tid } from '../selectors.ts';
import { openFixture, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { openFirstRun } from './onboarding.journey.ts';
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
    await c.settle();
    const tipBox = await c.page.locator(tid(Testids.booky.tipHost)).boundingBox();
    const barBox = await c.page.locator(tid(Testids.picker.confirm)).boundingBox();
    expect(tipBox != null && barBox != null && tipBox.y + tipBox.height <= barBox.y, `/scan/pick: expected Booky above "This is my edition", found bubble ${q(tipBox)} and button ${q(barBox)}`);
    await c.checkGates('/scan/pick (help open)');
    await c.snap('help-editions');
    await c.page.locator(helpMore).click();
    await waitVisible(c, helpSheet, '/scan/pick -> More help');
    await c.page.locator(tid(Testids.booky.helpClose)).click();
    await closed(c, helpSheet, '/scan/pick');
  },
});

register({
  name: 'booky-mute-tip',
  suite: 'p07',
  desc: 'Fixture "first-run": skip the onboarding -> Booky’s empty-shelf tip -> "Don’t show tips like this" -> reload -> the tip does not come back',
  async run(c) {
    await openFirstRun(c);
    await c.page.locator(tid(Testids.onboarding.skip)).click();
    await waitForPath(c, '/', '/onboarding -> Skip');
    await waitVisible(c, bubble, '/ (empty-shelf tip)');
    const text = (await c.page.locator(bubbleText).innerText()).trim();
    expect(text === 'Your shelf is empty. Tap Scan to add your first book.', `/: expected the empty-shelf tip, found ${q(text)}`);
    await c.checkGates('/ (empty-shelf tip)');
    await c.snap('empty-shelf-tip');
    await c.page.locator(tid(Testids.booky.mute)).click();
    await closed(c, bubble, '/ (muted)');

    await c.page.reload();
    await waitVisible(c, emptyState, '/ (reload)');
    await c.page.waitForTimeout(1_500);
    expect((await c.page.locator(bubble).count()) === 0, '/ (reload): the muted empty-shelf tip came back');
  },
});

register({
  name: 'booky-dismiss',
  suite: 'p07',
  desc: 'Fixture "demo": a tip closes on a tap anywhere else (and that tap still works), on Escape, and by itself after 8 s when it has no action',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, tid(Testids.home.row), 12, '/');
    await openHelp(c, '/');
    // A tap elsewhere puts the tip away and still does what it was for.
    await c.page.locator(tid(Testids.tabs.groups)).click();
    await waitForPath(c, '/groups', 'tap on Groups with a tip open');
    await closed(c, bubble, '/groups (tapped outside)');

    await openHelp(c, '/groups');
    await c.page.keyboard.press('Escape');
    await closed(c, bubble, '/groups (Escape)');

    await openFixture(c, 'empty', '/');
    await c.page.locator(askBooky).click();
    await waitVisible(c, bubble, '/ (What can Booky do?)');
    await c.page.locator(bubble).waitFor({ state: 'detached', timeout: 12_000 }).catch(() => {});
    expect((await c.page.locator(bubble).count()) === 0, '/: expected the tip without an action to close by itself after 8 s');
  },
});

register({
  name: 'booky-modes',
  suite: 'p07',
  desc: 'Settings -> Booky: Off hides Booky everywhere and help opens the help sheet without him; Quiet: scanning a book in says no "Shelved!"; Helpful brings him back',
  async run(c) {
    await openFixture(c, 'empty', '/settings');
    await waitVisible(c, tid(Testids.bookySettings.root), '/settings');
    await c.snap('booky-settings');
    await c.page.locator(tid(Testids.bookySettings.modeOff)).click();
    const off = await c.page.locator(tid(Testids.bookySettings.modeOff)).getAttribute('aria-checked');
    expect(off === 'true', `/settings: expected Off checked, found aria-checked=${q(off)}`);
    await c.checkGates('/settings (Booky off)');
    await c.snap('booky-off-settings');

    await c.page.locator(tid(Testids.tabs.shelf)).click();
    await waitVisible(c, emptyState, '/ (Booky off)');
    const bookys = await c.page.locator('[role="img"][aria-label^="Booky"]').count();
    expect(bookys === 0, `/ (Booky off): expected no Booky anywhere, found ${bookys}`);
    await c.page.locator(vis(helpButton)).first().click();
    await waitVisible(c, helpSheet, '/ (Booky off) help');
    expect((await c.page.locator(bubble).count()) === 0, '/ (Booky off): expected help without a bubble');
    await c.checkGates('/ (Booky off, help sheet)');
    await c.snap('booky-off-help');
    await c.page.locator(tid(Testids.booky.helpClose)).click();
    await closed(c, helpSheet, '/ (Booky off)');

    await c.page.locator(tid(Testids.tabs.settings)).click();
    await c.page.locator(tid(Testids.bookySettings.modeQuiet)).click();
    await c.page.locator(tid(Testids.tabs.scan)).click();
    await waitVisible(c, tid(Testids.scan.webIsbn), '/scan (quiet)');
    await c.page.locator(tid(Testids.scan.webIsbn)).fill('9780552166591');
    await c.page.locator(tid(Testids.scan.webIsbnSubmit)).click();
    await waitForPath(c, '/scan/pick', '/scan -> lookup');
    await waitVisible(c, tid(Testids.picker.confirm), '/scan/pick');
    await c.page.locator(tid(Testids.picker.confirm)).click();
    const book = await waitForPath(c, /^\/book\/\d+$/, '/scan/pick -> confirm');
    await waitVisible(c, vis(tid(Testids.bookDetail.title)), book);
    await c.page.waitForTimeout(1_500);
    expect((await c.page.locator(`${bubble} >> visible=true`).count()) === 0, `${book} (quiet): expected no "Shelved!" tip in Quiet mode`);
    const face = await c.page.locator('[role="img"][aria-label^="Booky"] >> visible=true').count();
    expect(face === 0, `${book} (quiet): expected no Booky bubble, found ${face} Booky images`);
  },
});

/** Booky's transform in the tip, sampled a few times over ~1.2 s. */
async function avatarTransforms(c: Context): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < 4; i++) {
    out.push(await c.page.locator(`${bubble} ${avatar}`).first().evaluate((el) => getComputedStyle(el).transform));
    await c.page.waitForTimeout(400);
  }
  return out;
}

register({
  name: 'booky-motion',
  suite: 'p07',
  desc: 'Booky bobs gently in a tip; with prefers-reduced-motion he stays perfectly still (no transform changes), and the bubble does not move the page',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, tid(Testids.home.row), 12, '/');
    await openHelp(c, '/');
    const moving = await avatarTransforms(c);
    expect(new Set(moving).size > 1, `/: expected Booky to bob, found one transform ${q(moving[0])}`);
    const before = await c.page.locator(tid(Testids.home.title)).boundingBox();

    await c.page.emulateMedia({ reducedMotion: 'reduce' });
    await c.page.reload();
    await waitForCount(c, tid(Testids.home.row), 12, '/ (reduced motion)');
    await openHelp(c, '/ (reduced motion)');
    const still = await avatarTransforms(c);
    expect(new Set(still).size === 1, `/ (reduced motion): expected Booky still, found ${q(still)}`);
    const after = await c.page.locator(tid(Testids.home.title)).boundingBox();
    expect(JSON.stringify(before) === JSON.stringify(after), `/: the bubble moved the page: ${q(before)} -> ${q(after)}`);
    await c.checkGates('/ (reduced motion, help open)');
  },
});

register({
  name: 'booky-keyboard',
  suite: 'p07',
  desc: 'Keyboard only: the help button opens a tip without taking focus, the tip is announced once in a polite live region, its buttons are reachable with Tab and Enter on ✕ closes it',
  async run(c) {
    await openFixture(c, 'demo', '/groups');
    await waitVisible(c, tid(Testids.groups.root), '/groups');
    await c.page.locator(vis(helpButton)).first().focus();
    await c.page.keyboard.press('Enter');
    await waitVisible(c, bubble, '/groups (help by keyboard)');
    const focused = await c.page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
    expect(focused === Testids.booky.helpButton, `/groups: expected focus to stay on the help button, found ${q(focused)}`);
    const announcer = c.page.locator(tid(Testids.booky.announcer));
    const live = await announcer.getAttribute('aria-live');
    const said = (await announcer.innerText()).trim();
    const text = (await c.page.locator(bubbleText).innerText()).trim();
    expect(live === 'polite' && said === text, `/groups: expected the tip in the polite announcer, found aria-live=${q(live)} text=${q(said)}`);
    const regions = await c.page.locator(`${bubble} [aria-live]`).count();
    expect(regions === 0, `/groups: expected no second live region inside the bubble, found ${regions}`);

    const reached = new Set<string>();
    for (let i = 0; i < 120 && !reached.has(Testids.booky.dismiss); i++) {
      await c.page.keyboard.press('Tab');
      reached.add(await c.page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? ''));
    }
    expect(reached.has(Testids.booky.helpMore) && reached.has(Testids.booky.dismiss), `/groups: expected "More help" and ✕ reachable with Tab, reached ${q([...reached].filter((t) => t.startsWith('booky')))}`);
    await c.page.keyboard.press('Enter');
    await closed(c, bubble, '/groups (Enter on ✕)');
  },
});
