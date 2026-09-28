// PLAN §8: Booky's floating tip never covers a control the user may need.
// Each journey opens a tip and runs expectTipCoversNothing (tipCover.ts):
// every control on the screen is either clear of the tip or can be scrolled
// clear of it, proven by hit-testing after scrolling. Covered: the overdue
// book (the nudge stays off its own page, whose Loan section already says it
// next to "Mark returned"), the empty-shelf tip, the series gap tip, help on
// every tab and on the book and series pages, and the backup reminder; at
// 100 % and 200 % text, in the light and the dark theme.
import { Testids, tid } from '../selectors.ts';
import { openBigFixture, openFixture, waitForBookyDecision, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { openFirstRun } from './onboarding.journey.ts';
import { expect, q, register, type Context } from './registry.ts';
import { expectTipCoversNothing, tipCover } from './tipCover.ts';

/** The demo fixture's overdue book, The Murder of Roger Ackroyd (lent to Priya). */
const OVERDUE_BOOK = '/book/10';
const NUDGE = '“The Murder of Roger Ackroyd” was due back from Priya 5 days ago.';

const bubble = tid(Testids.booky.bubble);
const bubbleText = tid(Testids.booky.bubbleText);
const dismiss = tid(Testids.booky.dismiss);
const vis = (selector: string) => `${selector} >> visible=true`;

/** Loads the app with text at `scale` (the web E2E font scale, as Android's font size setting). */
async function gotoAtScale(c: Context, path: string, scale: 1 | 2): Promise<void> {
  await c.goto(`${path}${path.includes('?') ? '&' : '?'}e2e-font-scale=${scale}`);
}

async function openHelp(c: Context, where: string): Promise<void> {
  await c.page.locator(vis(tid(Testids.booky.helpButton))).first().click();
  await waitVisible(c, bubble, `${where} (help)`);
}

async function closeTip(c: Context, where: string): Promise<void> {
  await c.page.locator(dismiss).first().click();
  try {
    await c.page.locator(bubble).waitFor({ state: 'detached', timeout: 5_000 });
  } catch {
    expect(false, `${where}: the tip did not close`);
  }
}

/** The tip's report names each control with its test id: these must be among those proven reachable. */
function expectReached(checked: string[], ids: string[], where: string): void {
  const missing = ids.filter((id) => !checked.some((n) => n.endsWith(`[${id}]`)));
  expect(missing.length === 0, `${where}: expected ${q(missing)} among the controls checked clear of the tip, found ${q(checked)}`);
}

/** The overdue book at one text size: no nudge over its own page, help that covers nothing, then the nudge on the Shelf. */
async function overdueAt(c: Context, scale: 1 | 2): Promise<void> {
  const at = `@${scale * 100}%`;
  // A fresh library each time: the nudge comes once a day, and the Shelf below uses it up.
  await openFixture(c, 'demo', '/');
  await gotoAtScale(c, OVERDUE_BOOK, scale);
  await waitVisible(c, vis(tid(Testids.bookLoan.stamp)), `${OVERDUE_BOOK} ${at}`);
  const summary = (await c.page.locator(vis(tid(Testids.bookLoan.summary))).first().innerText()).trim();
  expect(/It was due back on .* \(5 days ago\)\./.test(summary), `${OVERDUE_BOOK} ${at}: expected the Loan section to say it is overdue, found ${q(summary)}`);
  // The app has just started (Booky's overdue check runs now): it must stay quiet on this page.
  // The page shows the loan, so the nudge is kept for later rather than floated here.
  await waitForBookyDecision(c, 'loan-overdue', 0, `${OVERDUE_BOOK} ${at}`);
  await c.settle();
  expect((await c.page.locator(bubble).count()) === 0, `${OVERDUE_BOOK} ${at}: expected no overdue nudge over the overdue book's own page, found ${q(await c.page.locator(bubbleText).allInnerTexts())}`);
  await c.snap(`clear-overdue-book-${scale * 100}`);

  // Help is asked for, so it floats here: "Mark returned" and "About Priya" can still be reached.
  await openHelp(c, `${OVERDUE_BOOK} ${at}`);
  const report = await expectTipCoversNothing(c, `${OVERDUE_BOOK} ${at} (help)`);
  expectReached(report.checked, [Testids.returnLoan.open, Testids.bookLoan.borrower], `${OVERDUE_BOOK} ${at} (help)`);
  await c.checkGates(`${OVERDUE_BOOK} (help) ${at}`);
  await c.snap(`clear-overdue-book-help-${scale * 100}`);
  // Scrolled to the end, the Loan section's buttons sit clear above the tip.
  await c.page.locator(vis(tid(Testids.returnLoan.open))).first().scrollIntoViewIfNeeded();
  await c.page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      if (['auto', 'scroll'].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
    }
  });
  await c.settle();
  await c.snap(`clear-overdue-book-help-end-${scale * 100}`);
  await closeTip(c, `${OVERDUE_BOOK} ${at}`);

  // The nudge was not used up: starting again on the Shelf, it says it there, covering nothing.
  await gotoAtScale(c, '/', scale);
  await waitVisible(c, bubble, `/ ${at} (overdue nudge)`);
  const text = (await c.page.locator(bubbleText).innerText()).trim();
  expect(text === NUDGE, `/ ${at}: expected the overdue nudge, found ${q(text)}`);
  await expectTipCoversNothing(c, `/ ${at} (overdue nudge)`);
  await c.snap(`clear-overdue-nudge-shelf-${scale * 100}`);
  await closeTip(c, `/ ${at}`);
}

register({
  name: 'booky-clear-overdue-book',
  suite: 'p07',
  desc: 'Fixture "demo", at 100 % and 200 % text: the overdue nudge stays off The Murder of Roger Ackroyd’s own page (its Loan section says so beside "Mark returned"); help there covers no control that scrolling cannot clear, "Mark returned" and "About Priya" included; the nudge then shows on the Shelf, covering nothing',
  async run(c) {
    await overdueAt(c, 1);
    await overdueAt(c, 2);
  },
});

const tabs = [
  { key: 'shelf', tab: Testids.tabs.shelf, root: Testids.home.root },
  { key: 'scan', tab: Testids.tabs.scan, root: Testids.scan.root },
  { key: 'loans', tab: Testids.tabs.loans, root: Testids.loans.root },
  { key: 'groups', tab: Testids.tabs.groups, root: Testids.groups.root },
  { key: 'settings', tab: Testids.tabs.settings, root: Testids.settings.root },
] as const;

/** Help on every tab, then on a book and a series page: each tip covers nothing. */
async function helpEverywhere(c: Context, label: string): Promise<void> {
  for (const t of tabs) {
    const where = `tab ${t.key} (${label})`;
    await c.page.locator(tid(t.tab)).click();
    await waitVisible(c, tid(t.root), where);
    await openHelp(c, where);
    await expectTipCoversNothing(c, where);
    await c.snap(`clear-help-${t.key}-${label}`);
    await closeTip(c, where);
  }
  for (const [path, title] of [
    ['/book/1', Testids.bookDetail.title],
    ['/series/1', Testids.seriesDetail.title],
  ] as const) {
    await c.page.goto(c.url(path));
    await waitVisible(c, vis(tid(title)), `${path} (${label})`);
    // The app has started again: put away anything it said by itself (the overdue nudge) before asking for help.
    if (await c.page.locator(bubble).isVisible()) await closeTip(c, `${path} (${label})`);
    await openHelp(c, `${path} (${label})`);
    await expectTipCoversNothing(c, `${path} (${label}, help)`);
    await c.snap(`clear-help-${path.split('/')[1]}-${label}`);
    await closeTip(c, `${path} (${label})`);
  }
}

register({
  name: 'booky-clear-help',
  suite: 'p07',
  desc: 'Fixture "demo": the help tip on every tab, a book and a series covers no control that scrolling cannot clear, in the light theme at 100 % text and in the dark theme at 200 %',
  async run(c) {
    await c.page.emulateMedia({ colorScheme: 'light' });
    await openFixture(c, 'demo', '/');
    await waitForCount(c, tid(Testids.home.row), 12, '/');
    await helpEverywhere(c, 'light-100');

    await c.page.emulateMedia({ colorScheme: 'dark' });
    await gotoAtScale(c, '/', 2);
    await waitVisible(c, tid(Testids.home.root), '/ (dark, 200 %)');
    if (await c.page.locator(bubble).isVisible()) await closeTip(c, '/ (dark, 200 %)');
    const theme = await c.page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme === 'dark', `/: expected the dark theme, found data-theme=${q(theme)}`);
    await helpEverywhere(c, 'dark-200');
  },
});

register({
  name: 'booky-clear-nudges',
  suite: 'p07',
  desc: 'Booky’s unprompted tips cover no control that scrolling cannot clear: the empty-shelf tip (fixture "first-run"), the series gap tip after adding Discworld #6 (fixture "demo", also at 200 % text and dark), and the backup reminder 40 days on (fixture "large", on a book page)',
  async run(c) {
    await openFirstRun(c);
    await c.page.locator(tid(Testids.onboarding.skip)).click();
    await waitForPath(c, '/', '/onboarding -> Skip');
    await waitVisible(c, bubble, '/ (empty-shelf tip)');
    await expectTipCoversNothing(c, '/ (empty-shelf tip)');
    await c.snap('clear-empty-shelf-tip');

    for (const [scale, scheme, position, title] of [
      [1, 'light', 6, 'Wyrd Sisters'],
      [2, 'dark', 8, 'Pyramids'],
    ] as const) {
      const at = `@${scale * 100}% ${scheme}`;
      await c.page.emulateMedia({ colorScheme: scheme });
      await openFixture(c, 'demo', '/');
      await gotoAtScale(c, `/book/new?series=Discworld&position=${position}`, scale);
      await waitVisible(c, vis(tid(Testids.bookForm.title)), `/book/new ${at}`);
      await c.page.locator(vis(tid(Testids.bookForm.title))).first().fill(title);
      await c.page.locator(vis(tid(Testids.bookForm.save))).first().click();
      const path = await waitForPath(c, /^\/book\/\d+$/, `/book/new ${at} -> save`);
      await waitVisible(c, tid(Testids.seriesTip.root), `${path} ${at} (gap tip)`);
      // With the "Saved" snackbar up the tip is lifted above it; the snackbar hides what is under itself.
      // It lasts 4 s, so on a slow machine it can go mid-check, leaving the tip lifted over
      // controls the snackbar no longer hides (CI run 36452526433): the result only counts
      // while the snackbar is still up, and the docked check below covers the rest.
      await c.settle();
      await c.settle();
      const lifted = await tipCover(c.page);
      if (await c.page.locator(tid(Testids.snackbar.root)).count()) {
        expect(lifted.stuck.length === 0, `${path} ${at} (gap tip, snackbar up): Booky's tip ${q(lifted.tip)} covers ${lifted.stuck.length} control(s) that scrolling cannot bring clear: ${lifted.stuck.join('; ')}`);
        c.logf(`${path} ${at} (gap tip, snackbar up): ${lifted.checked.length} controls checked, ${lifted.revealed.length} revealed by scrolling`);
      } else {
        c.logf(`${path} ${at} (gap tip, snackbar up): the snackbar went during the check; left to the docked check`);
      }
      // Once the snackbar has gone, the tip docks again and the whole page is reachable.
      try {
        await c.page.locator(tid(Testids.snackbar.root)).waitFor({ state: 'detached', timeout: 15_000 });
      } catch {
        expect(false, `${path} ${at}: the "Saved" snackbar did not go away`);
      }
      const report = await expectTipCoversNothing(c, `${path} ${at} (gap tip)`);
      expectReached(report.checked, [Testids.groups.bookAdd, Testids.lend.open], `${path} ${at} (gap tip)`);
      await c.snap(`clear-series-gap-${scale * 100}-${scheme}`);
    }

    // Forty days on, a library of 10+ books never backed up: Booky suggests a backup when the app starts.
    await c.page.emulateMedia({ colorScheme: 'light' });
    // 2,000 books: loads slowly, so it gets the big-fixture wait, not the 15 s page check.
    await openBigFixture(c, 'large');
    await c.page.clock.setSystemTime(new Date(Date.now() + 40 * 24 * 60 * 60 * 1000));
    await gotoAtScale(c, '/book/1', 1);
    await waitVisible(c, vis(tid(Testids.bookDetail.title)), '/book/1 (40 days on)');
    await waitVisible(c, bubble, '/book/1 (backup reminder)');
    const text = (await c.page.locator(bubbleText).innerText()).trim();
    expect(/backup/.test(text), `/book/1: expected the backup reminder, found ${q(text)}`);
    const report = await expectTipCoversNothing(c, '/book/1 (backup reminder)');
    expectReached(report.checked, [Testids.lend.open], '/book/1 (backup reminder)');
    await c.checkGates('/book/1 (backup reminder)');
    await c.snap('clear-backup-reminder');
  },
});
