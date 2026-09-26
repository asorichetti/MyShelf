import { Testids, tid } from '../selectors.ts';
import { coverState, openFixture, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

// Loan dates in the demo fixture are relative to today; freeze it so stamps are exact.
// Dune: lent to Sam 5 Jun, due 26 Jun. Roger Ackroyd: lent to Priya, due 10 Jun (5 days overdue).
// Mort: lent to Sam, returned 14 Apr.
const TODAY = '2026-06-15';

const shelfRow = tid(Testids.home.row);
const loanRow = tid(Testids.loans.row);
const l = Testids.lend;

async function textOf(c: Context, selector: string): Promise<string> {
  return (await c.page.locator(selector).first().innerText()).trim();
}

async function openShelfBook(c: Context, title: string): Promise<string> {
  await waitForCount(c, shelfRow, 12, '/');
  await c.page.locator(`${shelfRow}[aria-label^="${title},"]`).click();
  const path = await waitForPath(c, /^\/book\/\d+$/, `/ -> ${title}`);
  await waitVisible(c, tid(Testids.bookDetail.title), path);
  return path;
}

/** The book titles of the loan rows, top to bottom. */
async function loanTitles(c: Context): Promise<string[]> {
  return c.page.locator(tid(Testids.loans.rowBook)).evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText.trim()));
}

async function gotoLoansTab(c: Context): Promise<void> {
  await c.page.locator(tid(Testids.tabs.loans)).click();
  await waitForPath(c, '/loans', 'tab Loans');
  await waitVisible(c, tid(Testids.loans.list), '/loans');
}

register({
  name: 'loan-lend-return',
  suite: 'p05',
  desc: 'Fixture "demo": lend a book at home to "sam" (the duplicate check offers the existing Sam), due in 14 days -> stamp on detail -> Loans tab -> mark returned -> History -> Undo',
  async run(c) {
    await openFixture(c, 'demo', '/', TODAY);
    const path = await openShelfBook(c, 'The Left Hand of Darkness');
    const loan = tid(Testids.bookDetail.loan);
    expect((await textOf(c, loan)).includes('not lent to anyone'), `${path}: expected the book to be at home`);

    await c.page.locator(tid(l.open)).click();
    await waitVisible(c, tid(l.sheet), `${path} (lend)`);
    expect((await c.page.locator(tid(l.sheet)).getAttribute('role')) === 'dialog', `${path}: expected the lend sheet to be role=dialog`);
    const lentOn = await c.page.locator(tid(l.lentOn)).inputValue();
    expect(lentOn === TODAY, `${path}: expected "Lent on" to default to today ${q(TODAY)}, found ${q(lentOn)}`);
    const due = await c.page.locator(tid(l.dueOn)).inputValue();
    expect(due === '2026-07-13', `${path}: expected the default due date 28 days on (2026-07-13), found ${q(due)}`);

    // Saving without a borrower says what is missing.
    await c.page.locator(tid(l.save)).click();
    await waitVisible(c, tid(l.error), `${path} (lend without borrower)`);
    const error = await textOf(c, tid(l.error));
    expect(/Choose who.s borrowing it/.test(error), `${path}: expected the missing-borrower message, found ${q(error)}`);

    // "sam" already exists as "Sam": the picker asks before making a duplicate.
    await c.page.locator(tid(l.borrowerSearch)).fill('sam');
    await waitVisible(c, tid(l.borrowerOption), `${path} (search sam)`);
    await c.page.locator(tid(l.borrowerCreate)).click();
    await waitVisible(c, tid(l.borrowerExisting), `${path} (duplicate)`);
    const dup = await textOf(c, tid(l.borrowerExisting));
    expect(dup.includes('Sam already exists — use them?'), `${path}: expected the duplicate suggestion, found ${q(dup)}`);
    await c.checkGates(`${path} (lend sheet)`);
    await c.page.locator(tid(l.borrowerUseExisting)).click();
    await waitVisible(c, tid(l.borrowerSelected), `${path} (Sam chosen)`);

    await c.page.locator(tid(l.dueOn)).fill('2026-06-29');
    await c.page.locator(tid(l.note)).fill('For the train');
    await c.snap('lend-sheet');
    await c.page.locator(tid(l.save)).click();
    await c.page.locator(tid(l.sheet)).waitFor({ state: 'detached', timeout: 10_000 });

    const stamp = tid(Testids.bookLoan.stamp);
    await waitVisible(c, stamp, `${path} (lent)`);
    const stampText = await textOf(c, stamp);
    expect(stampText === 'ON LOAN · SAM · DUE 29 JUN', `${path}: expected the stamp ${q('ON LOAN · SAM · DUE 29 JUN')}, found ${q(stampText)}`);
    const snack = await textOf(c, tid(Testids.snackbar.root));
    expect(snack === 'Lent to Sam', `${path}: expected the snackbar ${q('Lent to Sam')}, found ${q(snack)}`);
    expect((await c.page.locator(tid(l.open)).count()) === 0, `${path}: expected no Lend button while the book is out`);
    expect(await c.page.locator(tid(Testids.returnLoan.open)).isVisible(), `${path}: expected "Mark returned" while the book is out`);
    await c.checkGates(`${path} (on loan)`);
    await c.snap('lent');

    await c.page.locator(tid(Testids.bookDetail.back)).click();
    await waitForPath(c, '/', `${path} -> back`);
    await gotoLoansTab(c);
    await waitForCount(c, loanRow, 3, '/loans (after lending)');
    const titles = await loanTitles(c);
    expect(
      titles.join('|') === 'The Murder of Roger Ackroyd|Dune|The Left Hand of Darkness',
      `/loans: expected overdue first, then by due date, found ${q(titles)}`,
    );

    const row = c.page.locator(loanRow).filter({ hasText: 'The Left Hand of Darkness' });
    await row.locator(tid(Testids.loans.rowReturn)).click();
    await waitVisible(c, tid(Testids.returnLoan.sheet), '/loans (return)');
    const back = await c.page.locator(tid(Testids.returnLoan.date)).inputValue();
    expect(back === TODAY, `/loans: expected the return date to default to today, found ${q(back)}`);
    await c.checkGates('/loans (return sheet)');
    await c.snap('return-sheet');
    await c.page.locator(tid(Testids.returnLoan.confirm)).click();
    await c.page.locator(tid(Testids.returnLoan.sheet)).waitFor({ state: 'detached', timeout: 10_000 });
    await waitForCount(c, loanRow, 2, '/loans (after return)');
    const welcome = await textOf(c, tid(Testids.snackbar.root));
    expect(welcome.startsWith('Welcome home, “The Left Hand of Darkness”!'), `/loans: expected the welcome-home snackbar, found ${q(welcome)}`);

    await c.page.locator(tid(Testids.loans.tabHistory)).click();
    await c.page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('aria-selected') === 'true', tid(Testids.loans.tabHistory));
    await waitForCount(c, loanRow, 2, '/loans History');
    const history = await loanTitles(c);
    expect(history[0] === 'The Left Hand of Darkness', `/loans History: expected the new return first, found ${q(history)}`);
    const returned = await textOf(c, `${loanRow} ${tid(Testids.loans.stamp)}`);
    expect(returned === 'RETURNED 15 JUN', `/loans History: expected ${q('RETURNED 15 JUN')}, found ${q(returned)}`);
    await c.snap('loans-history');

    // Undo puts the loan back out.
    await c.page.locator(tid(Testids.snackbar.action)).click();
    await waitForCount(c, loanRow, 1, '/loans History after Undo');
    await c.page.locator(tid(Testids.loans.tabOut)).click();
    await waitForCount(c, loanRow, 3, '/loans Out now after Undo');
  },
});

register({
  name: 'loan-double-lend-blocked',
  suite: 'p05',
  desc: 'A book already on loan offers "Mark returned", not "Lend", so a second open loan cannot be started',
  async run(c) {
    await openFixture(c, 'demo', '/', TODAY);
    const path = await openShelfBook(c, 'Dune');
    await waitVisible(c, tid(Testids.bookLoan.stamp), path);
    expect((await c.page.locator(tid(Testids.lend.open)).count()) === 0, `${path}: expected no Lend button on a book that is out`);
    expect(await c.page.locator(tid(Testids.returnLoan.open)).isVisible(), `${path}: expected "Mark returned"`);
    const summary = await textOf(c, tid(Testids.bookLoan.summary));
    expect(summary === 'Lent to Sam on 5 Jun 2026. Due back on 26 Jun 2026.', `${path}: expected the loan summary, found ${q(summary)}`);
  },
});

register({
  name: 'loans-overview',
  suite: 'p05',
  desc: 'Fixture "demo", today fixed: the Loans tab lists 2 loans, overdue first with an "OVERDUE · 5 DAYS" stamp, the tab badge says 1 overdue, History has Mort, and the borrower filter narrows to Sam',
  async run(c) {
    await openFixture(c, 'demo', '/loans', TODAY);
    await waitForCount(c, loanRow, 2, '/loans');
    const titles = await loanTitles(c);
    expect(titles.join('|') === 'The Murder of Roger Ackroyd|Dune', `/loans: expected the overdue loan first, found ${q(titles)}`);
    const stamps = await c.page.locator(tid(Testids.loans.stamp)).evaluateAll((els) =>
      els.map((el) => ({ text: (el as HTMLElement).innerText.trim(), label: el.getAttribute('aria-label') ?? '' })),
    );
    expect(stamps[0]?.text === 'OVERDUE · 5 DAYS', `/loans: expected the first stamp ${q('OVERDUE · 5 DAYS')}, found ${q(stamps[0])}`);
    expect(/Overdue by 5 days/.test(stamps[0]?.label ?? ''), `/loans: expected the overdue stamp to be read out in words, found ${q(stamps[0])}`);
    expect(stamps[1]?.text === 'DUE 26 JUN', `/loans: expected Dune's stamp ${q('DUE 26 JUN')}, found ${q(stamps[1])}`);

    const tab = c.page.locator(tid(Testids.tabs.loans));
    const tabName = (await tab.getAttribute('aria-label')) ?? '';
    expect(tabName === 'Loans, 1 overdue', `/loans: expected the Loans tab to be named ${q('Loans, 1 overdue')}, found ${q(tabName)}`);
    const badge = (await tab.innerText()).replace(/\s+/g, ' ');
    expect(/\b1\b/.test(badge), `/loans: expected the tab badge to show 1, found ${q(badge)}`);
    await c.snap('loans-tab');

    const selected = await c.page.locator(tid(Testids.loans.tabOut)).getAttribute('aria-selected');
    expect(selected === 'true', `/loans: expected "Out now" selected, found aria-selected=${q(selected)}`);
    await c.page.locator(tid(Testids.loans.tabHistory)).click();
    await waitForCount(c, loanRow, 1, '/loans History');
    expect((await loanTitles(c))[0] === 'Mort', `/loans History: expected Mort, found ${q(await loanTitles(c))}`);
    const cover = await coverState(c, tid(Testids.loans.list));
    expect(cover.loaded === 1, `/loans History: expected Mort's real cover, found ${q(cover)}`);
    await c.checkGates('/loans (History)');

    await c.page.locator(tid(Testids.loans.tabOut)).click();
    await waitForCount(c, loanRow, 2, '/loans Out now');
    await c.page.locator(tid(Testids.loans.filterBorrower)).click();
    await c.page.getByRole('radio', { name: 'Sam' }).click();
    await waitForCount(c, loanRow, 1, '/loans filtered to Sam');
    expect((await loanTitles(c))[0] === 'Dune', `/loans filtered to Sam: expected Dune, found ${q(await loanTitles(c))}`);

    // The overdue book's own page says so too.
    await c.page.locator(tid(Testids.loans.filterBorrower)).click();
    await c.page.getByRole('radio', { name: 'Everyone' }).click();
    await waitForCount(c, loanRow, 2, '/loans unfiltered');
    await c.page.locator(tid(Testids.loans.rowBook)).first().click();
    const path = await waitForPath(c, /^\/book\/\d+$/, '/loans -> Roger Ackroyd');
    await waitVisible(c, tid(Testids.bookLoan.stamp), path);
    const stamp = await textOf(c, tid(Testids.bookLoan.stamp));
    expect(stamp === 'ON LOAN · PRIYA · OVERDUE · 5 DAYS', `${path}: expected the overdue stamp, found ${q(stamp)}`);
    const summary = await textOf(c, tid(Testids.bookLoan.summary));
    expect(summary.includes('It was due back on 10 Jun 2026 (5 days ago).'), `${path}: expected how long ago it was due, found ${q(summary)}`);
    await c.checkGates(`${path} (overdue)`);
    await c.snap('overdue-book');
  },
});

register({
  name: 'borrower-detail',
  suite: 'p05',
  desc: 'Loans tab -> Sam on Dune\'s row -> borrower detail with Dune under "Currently has" and Mort under "Has borrowed before"; removing Sam is blocked while Dune is out',
  async run(c) {
    await openFixture(c, 'demo', '/loans', TODAY);
    await waitForCount(c, loanRow, 2, '/loans');
    await c.page.locator(loanRow).filter({ hasText: 'Dune' }).locator(tid(Testids.loans.rowBorrower)).click();
    const path = await waitForPath(c, /^\/borrower\/\d+$/, '/loans -> Sam');
    await waitVisible(c, tid(Testids.borrower.name), path);
    await c.checkGates(path);
    const name = await textOf(c, tid(Testids.borrower.name));
    expect(name === 'Sam', `${path}: expected the h1 ${q('Sam')}, found ${q(name)}`);
    const current = await textOf(c, tid(Testids.borrower.current));
    expect(current.includes('Dune') && !current.includes('Mort'), `${path}: expected Dune (only) under "Currently has", found ${q(current)}`);
    const past = await textOf(c, tid(Testids.borrower.past));
    expect(past.includes('Mort') && !past.includes('Dune'), `${path}: expected Mort (only) under "Has borrowed before", found ${q(past)}`);
    const stats = await textOf(c, tid(Testids.borrower.stats));
    expect(stats === 'Has 1 book now · borrowed 2 times since 17 Mar 2026', `${path}: expected the borrower's stats, found ${q(stats)}`);
    await c.snap('borrower-detail');

    await c.page.locator(tid(Testids.borrower.delete)).click();
    await waitVisible(c, tid(Testids.borrower.blocked), `${path} (delete)`);
    const blocked = await textOf(c, tid(Testids.borrower.blocked));
    expect(blocked.includes('Sam still has 1 book of yours'), `${path}: expected the blocked-delete message, found ${q(blocked)}`);
    expect((await c.page.locator(tid(Testids.borrower.blocked)).getAttribute('role')) === 'alert', `${path}: expected the blocked message to be role=alert`);
    expect((await c.page.locator(tid(Testids.dialog.root)).count()) === 0, `${path}: expected no delete confirmation while a book is out`);
  },
});

register({
  name: 'loans-empty',
  suite: 'p05',
  desc: 'Fixture "empty": the Loans tab shows sleepy Booky with "Every book is home. Lovely."',
  async run(c) {
    await openFixture(c, 'empty', '/loans');
    const empty = tid(Testids.loans.empty);
    await waitVisible(c, empty, '/loans (empty)');
    const text = await textOf(c, empty);
    expect(text.includes('Every book is home. Lovely.'), `/loans (empty): expected the empty-state title, found ${q(text)}`);
    const booky = c.page.locator(empty).locator('[role="img"][aria-label^="Booky"]');
    const label = (await booky.getAttribute('aria-label')) ?? '';
    expect(/sleepy/i.test(label), `/loans (empty): expected a sleepy Booky, found ${q(label)}`);
    expect((await c.page.locator(loanRow).count()) === 0, '/loans (empty): expected no loan rows');
    await c.snap('loans-empty');
  },
});
