// P09-01: the accessibility audit's contracts. Large text (200 %) on the key
// screens, and the keyboard: sheets, dialogs, menus, the tab bar and the
// controls react-native-web does not press by itself; announcements.
import { Testids, tid } from '../selectors.ts';
import { openFixture, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const TODAY = '2026-06-15';
/** The demo fixture's first book (The Colour of Magic) and its overdue one (The Murder of Roger Ackroyd). */
const BOOK = '/book/1';
const OVERDUE_BOOK = '/book/10';

/** sessionStorage key the web E2E build reads its font scale from (src/features/e2e/fontScale.web.ts). */
const FONT_SCALE_KEY = 'myshelf-e2e-font-scale';

/** What has keyboard focus: its test id, role, accessible name, and whether it is inside a modal. */
interface Focus {
  testid: string | null;
  role: string | null;
  name: string;
  inModal: boolean;
  tag: string;
  /** A scroll container (Chromium lets the keyboard focus one to scroll it). */
  scroller: boolean;
}

function focused(c: Context): Promise<Focus> {
  return c.page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const modal = [...document.querySelectorAll('[aria-modal="true"]')].filter((m) => m.getBoundingClientRect().height > 0);
    return {
      testid: el?.getAttribute('data-testid') ?? null,
      role: el?.getAttribute('role') ?? null,
      name: (el?.getAttribute('aria-label') || el?.textContent || '').trim().slice(0, 80),
      inModal: !!el && modal.some((m) => m.contains(el)),
      tag: el?.tagName.toLowerCase() ?? 'none',
      scroller: !!el && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight,
    };
  });
}

const show = (f: Focus) => `${f.tag}${f.role ? `[role=${f.role}]` : ''}${f.testid ? `[${f.testid}]` : ''} ${q(f.name)}`;

/** Presses Tab until the element with `testid` has focus: proves it is in the Tab order. */
async function tabTo(c: Context, testid: string, where: string, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    await c.page.keyboard.press('Tab');
    if ((await focused(c)).testid === testid) return;
  }
  expect(false, `${where}: ${testid} was not reached with Tab in ${max} presses (focus on ${show(await focused(c))})`);
}

async function expectFocus(c: Context, testid: string, where: string): Promise<void> {
  // Focus returns once the modal has gone: wait for it rather than for a clock.
  await c.page
    .waitForFunction((id) => document.activeElement?.getAttribute('data-testid') === id, testid, { timeout: 5_000 })
    .catch(() => undefined);
  const f = await focused(c);
  expect(f.testid === testid, `${where}: expected focus on ${testid}, found ${show(f)}`);
}

async function waitGone(c: Context, selector: string, where: string): Promise<void> {
  try {
    await c.page.locator(selector).first().waitFor({ state: 'detached', timeout: 5_000 });
  } catch {
    expect(false, `${where}: ${selector} was still open`);
  }
}

/**
 * The modal contract: focus is inside, every dialog on the page has a name
 * (react-native-web's own wrapper included), and Tab never leaves the modal.
 */
async function expectTrapped(c: Context, where: string, presses = 15): Promise<void> {
  // The modal takes focus once it has finished opening.
  await c.page
    .waitForFunction(() => {
      const el = document.activeElement;
      return !!el && [...document.querySelectorAll('[aria-modal="true"]')].some((m) => m.getBoundingClientRect().height > 0 && m.contains(el));
    }, undefined, { timeout: 5_000 })
    .catch(() => undefined);
  const f = await focused(c);
  expect(f.inModal, `${where}: expected focus inside the modal when it opens, found ${show(f)}`);
  const unnamed = await c.page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="menu"]')]
      .filter((d) => d.getBoundingClientRect().height > 0 && !(d.getAttribute('aria-label') || d.getAttribute('aria-labelledby')))
      .map((d) => d.outerHTML.slice(0, 120)),
  );
  expect(unnamed.length === 0, `${where}: expected every dialog to have a name, found unnamed ${q(unnamed)}`);
  for (let i = 0; i < presses; i++) {
    await c.page.keyboard.press('Tab');
    const now = await focused(c);
    expect(now.inModal, `${where}: Tab ${i + 1} left the modal for ${show(now)}`);
    // A scroller with no focusable child to scroll by is a Tab stop in Chromium, so the keyboard can scroll it; anything else needs a role.
    expect(now.role !== null || now.scroller || ['input', 'textarea', 'button', 'a', 'select'].includes(now.tag), `${where}: Tab ${i + 1} stopped on ${show(now)}, which has no role`);
  }
}

// ---- Large text ----

/** Text the page cuts off: truncated with no full accessible name nearby, or pushed outside a clipping box. */
function textProblems(c: Context): Promise<string[]> {
  return c.page.evaluate(() => {
    const out: string[] = [];
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"]');
    };
    for (const el of document.querySelectorAll<HTMLElement>('main div[dir], main span, [role="dialog"] div[dir]')) {
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
      if (!text || !visible(el)) continue;
      const cs = getComputedStyle(el);
      const clamped = (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') || cs.textOverflow === 'ellipsis';
      if (clamped && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) {
        // Truncated on purpose: a screen reader must still get all of it.
        let named = false;
        for (let p: HTMLElement | null = el; p && !named; p = p.parentElement) named = (p.getAttribute('aria-label') ?? '').includes(text);
        if (!named) out.push(`truncated with no full name: ${JSON.stringify(text.slice(0, 60))}`);
      }
      // Cut off by the nearest box that clips.
      const r = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
        if (['auto', 'scroll'].includes(ps.overflowX) || ['auto', 'scroll'].includes(ps.overflowY)) break;
        const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 2 || r.left < pr.left - 2 || r.bottom > pr.bottom + 2 || r.top < pr.top - 2) {
          out.push(`cut off by its box: ${JSON.stringify(text.slice(0, 60))} in ${p.getAttribute('data-testid') ?? p.tagName.toLowerCase()}`);
        }
        break;
      }
    }
    return [...new Set(out)];
  });
}

/** Checks the screen now showing at 200 % text: text really is doubled, and none is cut off. Page gates run too. */
async function checkLargeText(c: Context, where: string, snap: string, gates = false): Promise<void> {
  if (gates) await c.checkGates(`${where} @200% text`);
  const size = await c.page.evaluate(() => {
    const h1 = [...document.querySelectorAll('[role="heading"][aria-level="1"], h1')].find((h) => h.getBoundingClientRect().height > 0);
    return h1 ? getComputedStyle(h1).fontSize : null;
  });
  // The book page's title is the catalogue card's h1 style (28 px), like every other screen's h1.
  expect(size === '56px', `${where}: expected the h1 at 200 % (56px), found ${q(size)}`);
  const problems = await textProblems(c);
  expect(problems.length === 0, `${where}: text cut off at 200 %: ${problems.join('; ')}`);
  await c.snap(`large-text-${snap}`);
}

/** The tab bar grows with its labels (capped at 150 %), so none is clipped. */
async function checkTabLabels(c: Context): Promise<void> {
  const tabs = await c.page.evaluate((ids) => ids.map((id) => {
    const tab = document.querySelector(`[data-testid="${id}"]`);
    const label = [...(tab?.querySelectorAll('div[dir]') ?? [])].find((d) => (d.textContent ?? '').trim());
    if (!tab || !label) return `${id}: missing`;
    const t = tab.getBoundingClientRect();
    const l = label.getBoundingClientRect();
    if (label.scrollWidth > label.clientWidth + 1) return `${id}: label cut short`;
    return l.bottom <= t.bottom + 1 && l.top >= t.top - 1 ? '' : `${id}: label outside its tab`;
  }), [Testids.tabs.shelf, Testids.tabs.scan, Testids.tabs.loans, Testids.tabs.groups, Testids.tabs.settings]);
  expect(tabs.every((t) => t === ''), `/settings: tab labels at 200 %: ${tabs.filter(Boolean).join('; ')}`);
}

register({
  name: 'a11y-large-text',
  suite: 'p09',
  desc: 'Text at 200 % (the web E2E font scale, as Android\'s largest font size): the Shelf, a book, the edit form, a lend sheet, Loans, Groups, Scan, Settings, a series and the covers grid keep every word on screen (no sideways overflow, nothing cut off, truncated text named in full) and pass the page gates',
  async run(c) {
    await c.page.addInitScript(([key]) => sessionStorage.setItem(key!, '2'), [FONT_SCALE_KEY]);
    await openFixture(c, 'demo', '/', TODAY);
    await checkLargeText(c, '/', 'shelf');

    await c.goto(OVERDUE_BOOK);
    await waitVisible(c, tid(Testids.bookLoan.stamp), `${OVERDUE_BOOK} @200%`);
    await checkLargeText(c, OVERDUE_BOOK, 'book');

    await c.goto(`${BOOK}/edit`);
    await checkLargeText(c, `${BOOK}/edit`, 'form');

    await c.goto(BOOK);
    await c.page.locator(tid(Testids.lend.open)).click();
    await waitVisible(c, tid(Testids.lend.sheet), `${BOOK} (lend) @200%`);
    await c.checkGates(`${BOOK} (lend sheet) @200% text`);
    const sheetProblems = await textProblems(c);
    expect(sheetProblems.length === 0, `${BOOK} (lend sheet): text cut off at 200 %: ${sheetProblems.join('; ')}`);
    await c.snap('large-text-lend-sheet');

    for (const [path, snap] of [
      ['/loans', 'loans'],
      ['/groups', 'groups'],
      ['/scan', 'scan'],
      ['/settings', 'settings'],
      ['/series/1', 'series'],
    ] as const) {
      await c.goto(path);
      await checkLargeText(c, path, snap);
      if (path === '/settings') await checkTabLabels(c);
    }

    await c.goto('/');
    await c.page.locator(tid(Testids.shelfView.modeCovers)).click();
    await waitVisible(c, tid(Testids.shelfView.coverCell), '/ (covers) @200%');
    await checkLargeText(c, '/ (covers)', 'covers', true);
  },
});

// ---- Keyboard ----

register({
  name: 'a11y-keyboard-sheets',
  suite: 'p09',
  desc: 'Keyboard only: Enter opens the lend sheet, the new-group sheet (whose name field takes focus), a select list (on its current choice) and, with Space, the filter sheet; focus starts inside, every dialog is named, Tab stays inside, Space ticks a filter, and Escape closes each one with focus back on the control that opened it',
  async run(c) {
    await openFixture(c, 'demo', BOOK, TODAY);
    await tabTo(c, Testids.lend.open, BOOK);
    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.lend.sheet), `${BOOK} (Enter on Lend)`);
    await expectTrapped(c, `${BOOK} (lend sheet)`);
    await c.page.keyboard.press('Escape');
    await waitGone(c, tid(Testids.lend.sheet), `${BOOK} (Escape)`);
    await expectFocus(c, Testids.lend.open, `${BOOK} (lend sheet closed)`);

    // The name field takes focus as the sheet opens; closing it used to drop focus on the page.
    await c.goto('/groups');
    await tabTo(c, Testids.groups.new, '/groups');
    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.groups.editorSheet), '/groups (Enter on New group)');
    await expectFocus(c, Testids.groups.editorName, '/groups (new group sheet)');
    await expectTrapped(c, '/groups (new group sheet)');
    await c.page.keyboard.press('Escape');
    await waitGone(c, tid(Testids.groups.editorSheet), '/groups (Escape)');
    await expectFocus(c, Testids.groups.new, '/groups (new group sheet closed)');

    await c.goto('/');
    await tabTo(c, Testids.shelfView.filterButton, '/');
    await c.page.keyboard.press(' ');
    await waitVisible(c, tid(Testids.shelfView.filterSheet), '/ (Space on Filter)');
    await expectTrapped(c, '/ (filter sheet)', 6);
    await tabTo(c, Testids.shelfView.filterGenre, '/ (filter sheet)', 20);
    const genre = await focused(c);
    await c.page.keyboard.press(' ');
    const checked = await c.page.evaluate(() => document.activeElement?.getAttribute('aria-checked'));
    expect(checked === 'true', `/ (filter sheet): expected Space to tick ${q(genre.name)}, found aria-checked=${q(checked)}`);
    await c.page.keyboard.press('Escape');
    await waitGone(c, tid(Testids.shelfView.filterSheet), '/ (Escape)');
    await expectFocus(c, Testids.shelfView.filterButton, '/ (filter sheet closed)');

    // A select list opens on its current choice and gives focus back to its field.
    const edit = `${BOOK}/edit`;
    await c.goto(edit);
    await tabTo(c, Testids.bookForm.language, edit);
    await c.page.keyboard.press('Enter');
    await c.page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'radio', undefined, { timeout: 5_000 }).catch(() => undefined);
    const choice = await c.page.evaluate(() => ({ role: document.activeElement?.getAttribute('role'), checked: document.activeElement?.getAttribute('aria-checked'), name: document.activeElement?.getAttribute('aria-label') }));
    expect(choice.role === 'radio' && choice.checked === 'true' && choice.name === 'English', `${edit} (language list): expected focus on the checked "English", found ${q(choice)}`);
    await expectTrapped(c, `${edit} (language list)`, 3);
    await c.page.keyboard.press('Escape');
    await expectFocus(c, Testids.bookForm.language, `${edit} (language list closed)`);
  },
});

register({
  name: 'a11y-keyboard-menu-dialog',
  suite: 'p09',
  desc: 'Keyboard only on a book: More opens a named menu with focus on its first item; the arrow keys, Home and End move between items; Escape closes it with focus back on More; Delete opens the alert dialog with focus inside, and Escape keeps the book and puts focus back on More',
  async run(c) {
    await openFixture(c, 'demo', BOOK, TODAY);
    const more = Testids.bookDetail.more;
    await tabTo(c, more, BOOK);
    const expanded = () => c.page.locator(tid(more)).getAttribute('aria-expanded');
    expect((await expanded()) === 'false', `${BOOK}: expected More to report aria-expanded=false, found ${q(await expanded())}`);
    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.menu.root), `${BOOK} (Enter on More)`);
    await expectTrapped(c, `${BOOK} (menu)`, 0);
    const items = await c.page.locator(`${tid(Testids.menu.root)} [role="menuitem"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(items.length >= 2, `${BOOK} (menu): expected at least two items, found ${q(items)}`);
    await expectFocus(c, items[0]!, `${BOOK} (menu opened)`);
    await c.page.keyboard.press('ArrowDown');
    await expectFocus(c, items[1]!, `${BOOK} (ArrowDown)`);
    await c.page.keyboard.press('End');
    await expectFocus(c, items[items.length - 1]!, `${BOOK} (End)`);
    await c.page.keyboard.press('ArrowDown');
    await expectFocus(c, items[0]!, `${BOOK} (ArrowDown wraps)`);
    await c.page.keyboard.press('ArrowUp');
    await expectFocus(c, items[items.length - 1]!, `${BOOK} (ArrowUp wraps)`);
    await c.page.keyboard.press('Home');
    await expectFocus(c, items[0]!, `${BOOK} (Home)`);
    await c.page.keyboard.press('Escape');
    await waitGone(c, tid(Testids.menu.root), `${BOOK} (Escape on menu)`);
    await expectFocus(c, more, `${BOOK} (menu closed)`);

    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.menu.root), `${BOOK} (More again)`);
    await c.page.locator(tid(Testids.bookDetail.delete)).focus();
    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.dialog.root), `${BOOK} (Delete)`);
    const role = await c.page.locator(tid(Testids.dialog.root)).getAttribute('role');
    expect(role === 'alertdialog', `${BOOK}: expected an alertdialog, found role=${q(role)}`);
    await expectTrapped(c, `${BOOK} (delete dialog)`, 4);
    await c.page.keyboard.press('Escape');
    await waitGone(c, tid(Testids.dialog.root), `${BOOK} (Escape on dialog)`);
    await expectFocus(c, more, `${BOOK} (dialog closed)`);
    expect(new URL(c.page.url()).pathname === BOOK, `${BOOK}: expected Escape to keep the book, found ${q(new URL(c.page.url()).pathname)}`);
  },
});

register({
  name: 'a11y-keyboard-tabs',
  suite: 'p09',
  desc: 'Keyboard only: Space and Enter on the tab bar switch tabs and move aria-selected; Space picks the Loans screen\'s History tab; Enter opens a Settings row, a series row and an author row (links drawn as divs); Space chooses a Booky mode, flips a switch and ticks a checkbox',
  async run(c) {
    await openFixture(c, 'demo', '/', TODAY);
    await tabTo(c, Testids.tabs.loans, '/');
    await c.page.keyboard.press(' ');
    await waitForPath(c, '/loans', '/ (Space on the Loans tab)');
    const selected = (id: string) => c.page.locator(tid(id)).getAttribute('aria-selected');
    expect((await selected(Testids.tabs.loans)) === 'true', `/loans: expected the Loans tab selected, found ${q(await selected(Testids.tabs.loans))}`);

    await waitVisible(c, tid(Testids.loans.tabHistory), '/loans');
    await tabTo(c, Testids.loans.tabHistory, '/loans');
    await c.page.keyboard.press(' ');
    await c.page.waitForFunction((id) => document.querySelector(`[data-testid="${id}"]`)?.getAttribute('aria-selected') === 'true', Testids.loans.tabHistory, { timeout: 5_000 }).catch(() => undefined);
    expect((await selected(Testids.loans.tabHistory)) === 'true', `/loans: expected Space to select History, found ${q(await selected(Testids.loans.tabHistory))}`);
    expect((await selected(Testids.loans.tabOut)) === 'false', `/loans: expected Out now no longer selected`);

    await tabTo(c, Testids.tabs.settings, '/loans');
    await c.page.keyboard.press('Enter');
    await waitForPath(c, '/settings', '/loans (Enter on the Settings tab)');

    // Switches, radios and checkboxes take Space, as native controls do.
    const checkedOf = (id: string) => c.page.locator(tid(id)).getAttribute('aria-checked');
    const data = Testids.settings.coversOnDataToggle;
    const before = await checkedOf(data);
    await tabTo(c, data, '/settings');
    await c.page.keyboard.press(' ');
    await c.page.waitForFunction(([id, was]) => document.querySelector(`[data-testid="${id}"]`)?.getAttribute('aria-checked') !== was, [data, before] as const, { timeout: 5_000 }).catch(() => undefined);
    expect((await checkedOf(data)) !== before, `/settings: expected Space to flip ${data} from ${q(before)}`);
    await c.page.keyboard.press(' ');
    await c.page.waitForFunction(([id, was]) => document.querySelector(`[data-testid="${id}"]`)?.getAttribute('aria-checked') === was, [data, before] as const, { timeout: 5_000 }).catch(() => undefined);
    expect((await checkedOf(data)) === before, `/settings: expected a second Space to flip ${data} back to ${q(before)}`);

    await c.page.locator(tid(Testids.bookySettings.modeQuiet)).focus();
    await c.page.keyboard.press(' ');
    await c.page.waitForFunction((id) => document.querySelector(`[data-testid="${id}"]`)?.getAttribute('aria-checked') === 'true', Testids.bookySettings.modeQuiet, { timeout: 5_000 }).catch(() => undefined);
    expect((await checkedOf(Testids.bookySettings.modeQuiet)) === 'true', '/settings: expected Space to choose the Quiet Booky mode');
    await c.page.locator(tid(Testids.bookySettings.modeHelpful)).focus();
    await c.page.keyboard.press(' ');

    await c.page.locator(tid(Testids.settings.preferences)).focus();
    await c.page.keyboard.press('Enter');
    await waitForPath(c, '/settings/preferences', '/settings (Enter on Shelf and lending)');

    await c.goto('/settings/erase');
    await tabTo(c, Testids.erase.resetSettings, '/settings/erase');
    await c.page.keyboard.press(' ');
    expect((await checkedOf(Testids.erase.resetSettings)) === 'true', '/settings/erase: expected Space to tick "Also reset my settings"');

    await c.goto('/series');
    await tabTo(c, Testids.seriesList.row, '/series');
    await c.page.keyboard.press('Enter');
    await waitForPath(c, /^\/series\/\d+$/, '/series (Enter on a series)');

    await c.goto('/authors');
    await tabTo(c, Testids.authors.row, '/authors');
    await c.page.keyboard.press('Enter');
    await waitForPath(c, /^\/authors\/\d+$/, '/authors (Enter on an author)');
  },
});

register({
  name: 'a11y-keyboard-lend-return',
  suite: 'p09',
  desc: 'Lend and return by keyboard alone, and hear it: the snackbar\'s live region is on the page, empty, before "Lent to Sam" arrives in it; focus moves from the vanished Lend button to Mark returned, whose sheet traps focus; after returning focus is on Lend again and "Welcome home" is announced',
  async run(c) {
    await openFixture(c, 'demo', BOOK, TODAY);
    // Mark the empty polite regions now: the message must arrive in one that was already there.
    await c.page.evaluate(() => {
      for (const r of document.querySelectorAll('[role="status"][aria-live="polite"]')) if (!(r.textContent ?? '').trim()) r.setAttribute('data-empty-before', '1');
    });
    await tabTo(c, Testids.lend.open, BOOK);
    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.lend.sheet), `${BOOK} (lend)`);
    await expectFocus(c, Testids.lend.borrowerSearch, `${BOOK} (lend sheet)`);
    await c.page.keyboard.type('Sam');
    await tabTo(c, Testids.lend.borrowerOption, `${BOOK} (lend sheet)`, 5);
    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.lend.borrowerSelected), `${BOOK} (Sam chosen)`);
    await tabTo(c, Testids.lend.save, `${BOOK} (lend sheet)`, 20);
    await c.page.keyboard.press('Enter');
    await waitGone(c, tid(Testids.lend.sheet), `${BOOK} (lent)`);
    await waitVisible(c, tid(Testids.snackbar.root), `${BOOK} (snackbar)`);
    const region = await c.page.locator(tid(Testids.snackbar.root)).evaluate((bar) => {
      const r = bar.parentElement?.closest('[role="status"]');
      return { text: (r?.textContent ?? '').trim(), live: r?.getAttribute('aria-live'), wasThere: r?.getAttribute('data-empty-before') === '1' };
    });
    expect(region.text.startsWith('Lent to Sam'), `${BOOK}: expected "Lent to Sam" in a live region, found ${q(region.text)}`);
    expect(region.live === 'polite' && region.wasThere, `${BOOK}: expected the message in a polite region that was on the page before it, found ${q(region)}`);

    // Lend has gone and Mark returned has taken its place, and focus with it.
    await expectFocus(c, Testids.returnLoan.open, `${BOOK} (after lending)`);
    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.returnLoan.sheet), `${BOOK} (return)`);
    await expectTrapped(c, `${BOOK} (return sheet)`, 3);
    await tabTo(c, Testids.returnLoan.confirm, `${BOOK} (return sheet)`, 10);
    await c.page.keyboard.press('Enter');
    await waitGone(c, tid(Testids.returnLoan.sheet), `${BOOK} (returned)`);
    await waitVisible(c, tid(Testids.bookLoan.welcome), `${BOOK} (welcome home)`);
    const welcome = await c.page.locator(tid(Testids.bookLoan.welcome)).evaluate((w) => ({ role: w.getAttribute('role'), live: w.getAttribute('aria-live') }));
    expect(welcome.role === 'status' && welcome.live === 'polite', `${BOOK}: expected "Welcome home" to be a polite status, found ${q(welcome)}`);
    // Mark returned has gone and Lend is back, with focus on it rather than dropped on the page.
    await expectFocus(c, Testids.lend.open, `${BOOK} (after returning)`);
    const snack = await c.page.locator(tid(Testids.snackbar.root)).evaluate((bar) => (bar.parentElement?.closest('[role="status"]')?.textContent ?? '').trim());
    expect(snack.startsWith('Welcome home'), `${BOOK}: expected "Welcome home…" announced in the snackbar's live region, found ${q(snack)}`);
  },
});

register({
  name: 'a11y-help-focus',
  suite: 'p09',
  desc: 'Keyboard only: the help button opens Booky\'s tip without moving focus; Tab reaches More help; Enter opens the help sheet with focus inside; Escape closes it and focus goes back to the help button, although the tip that held More help has gone',
  async run(c) {
    await openFixture(c, 'demo', '/', TODAY);
    const help = Testids.booky.helpButton;
    await tabTo(c, help, '/');
    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.booky.bubble), '/ (help)');
    await expectFocus(c, help, '/ (tip open)');
    // The tip is drawn above everything, so it comes after the page and the tab bar in the Tab order.
    await tabTo(c, Testids.booky.helpMore, '/ (tip open)', 80);
    await c.page.keyboard.press('Enter');
    await waitVisible(c, tid(Testids.booky.helpSheet), '/ (More help)');
    await expectTrapped(c, '/ (help sheet)', 3);
    await c.page.keyboard.press('Escape');
    await waitGone(c, tid(Testids.booky.helpSheet), '/ (Escape)');
    await expectFocus(c, help, '/ (help sheet closed)');
  },
});
