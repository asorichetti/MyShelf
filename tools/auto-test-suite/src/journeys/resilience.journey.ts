// P09-04: one broken screen never blanks the app, and a database that will
// not open gets a recovery screen. Both use E2E-only hooks: `crash=<route>`
// on /e2e makes that screen throw while rendering until its error boundary has
// caught it, and `?e2e-db-fault=open|migrate` makes the first attempt to open
// the database fail.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { Testids, tid } from '../selectors.ts';
import { openFixture, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const EB = Testids.errorBoundary;
/** The only errors these journeys may log: the ones they plant. */
const PLANTED = /E2E crash test: the .+ screen threw on purpose|E2E: a simulated (failure opening the database|migration failure)/;

/**
 * The planted failures are logged as errors (React reports every error a
 * boundary catches; the database provider logs its failure). The console gate
 * is waived for this journey only, and this checks that every error logged
 * is a planted one, so a real error still fails the run.
 */
function allowOnlyPlantedErrors(c: Context): () => void {
  c.gates.waive('console', 'error', 'this journey plants a render error or a database failure on purpose; every logged error is checked to be the planted one');
  c.gates.waive('pagestate', 'error-marker', 'the error screens are what this journey checks');
  return () => {
    const errors = c.listeners.snapshot().console.filter((e) => e.isError);
    const other = errors.filter((e) => !PLANTED.test(e.text));
    expect(errors.length > 0, 'expected the planted failure to be logged');
    expect(other.length === 0, `expected only the planted failures in the console, also found ${q(other.map((e) => e.text.slice(0, 200)))}`);
  };
}

/** Checks the error boundary's screen: one h1, concerned Booky, Try again and Copy error details, and the planted message. */
async function expectErrorScreen(c: Context, where: string): Promise<void> {
  await waitVisible(c, tid(EB.root), where);
  await waitVisible(c, tid(Testids.pageState.error), where);
  const title = c.page.locator(tid(EB.title));
  const info = await title.evaluate((el) => ({ tag: el.tagName, level: el.getAttribute('aria-level'), text: (el as HTMLElement).innerText }));
  expect(info.text === 'Something went wrong here', `${where}: expected the h1 ${q('Something went wrong here')}, found ${q(info.text)}`);
  expect(info.tag === 'H1' || info.level === '1', `${where}: expected the title to be the h1, found <${info.tag} aria-level=${info.level}>`);
  const booky = c.page.locator(tid(EB.root)).locator('[role="img"][aria-label^="Booky"]');
  expect((await booky.count()) === 1, `${where}: expected a concerned Booky`);
  for (const [id, name] of [
    [EB.retry, 'Try again'],
    [EB.copy, 'Copy error details'],
  ]) {
    const label = (await c.page.locator(tid(id)).getAttribute('aria-label')) ?? (await c.page.locator(tid(id)).innerText());
    expect(label.trim() === name, `${where}: expected the button ${q(name)}, found ${q(label)}`);
  }
  const details = await c.page.locator(tid(EB.details)).innerText();
  expect(PLANTED.test(details), `${where}: expected the planted error in the details, found ${q(details)}`);
}

register({
  name: 'error-boundary',
  suite: 'p09',
  desc: 'E2E crash trigger: the Loans tab throws → Booky\'s "Something went wrong here" with Try again and Copy error details (copied to the clipboard); the tab bar still works; Try again renders Loans; a crashing book page offers the way back to a working Shelf',
  async run(c) {
    const onlyPlanted = allowOnlyPlantedErrors(c);
    await c.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // A tab that crashes.
    await c.page.goto(c.url(`/e2e?fixture=demo&crash=loans&next=${encodeURIComponent('/loans')}`), { waitUntil: 'load' });
    await waitForPath(c, '/loans', '/e2e -> /loans');
    await expectErrorScreen(c, '/loans (crashed)');
    await c.checkGates('/loans (crashed)');
    await c.snap('crashed-loans');
    expect(await c.page.locator(tid(Testids.tabs.shelf)).isVisible(), '/loans (crashed): expected the tab bar to stay');

    await c.page.locator(tid(EB.copy)).click();
    await waitVisible(c, tid(EB.copied), '/loans (copied)');
    const status = await c.page.locator(tid(EB.copied)).innerText();
    expect(/^Copied/.test(status), `/loans: expected "Copied…" after Copy error details, found ${q(status)}`);
    const clip = await c.page.evaluate(() => navigator.clipboard.readText());
    expect(/^MyShelf .+\nScreen: loans\n/.test(clip) && PLANTED.test(clip), `/loans: expected the error details on the clipboard, found ${q(clip.slice(0, 200))}`);

    await c.page.locator(tid(EB.retry)).click();
    await waitForCount(c, tid(Testids.loans.row), 2, '/loans (after Try again)');
    expect((await c.page.locator(tid(EB.root)).count()) === 0, '/loans: expected the error screen gone after Try again');
    await c.checkGates('/loans (recovered)');

    // A stack screen that crashes: the way back leads to a working Shelf and tabs.
    await c.page.goto(c.url(`/e2e?fixture=demo&crash=${encodeURIComponent('book/[id]')}&next=${encodeURIComponent('/')}`), { waitUntil: 'load' });
    await waitForPath(c, '/', '/e2e -> /');
    await waitForCount(c, tid(Testids.home.row), 12, '/');
    await c.page.locator(`${tid(Testids.home.row)}[aria-label^="Dune,"]`).click();
    await waitForPath(c, /^\/book\/\d+$/, '/ -> Dune');
    await expectErrorScreen(c, '/book (crashed)');
    await c.snap('crashed-book');
    await c.page.getByRole('button', { name: 'Go to my shelf' }).click();
    await waitForPath(c, '/', '/book (crashed) -> Go to my shelf');
    await waitForCount(c, tid(Testids.home.row), 12, '/ (after the crash)');
    await c.page.locator(tid(Testids.tabs.loans)).click();
    await waitForPath(c, '/loans', '/ -> Loans');
    await waitVisible(c, tid(Testids.loans.root), '/loans');
    await c.page.locator(tid(Testids.tabs.shelf)).click();
    await waitForPath(c, '/', '/loans -> Shelf');
    await c.page.locator(`${tid(Testids.home.row)}[aria-label^="Dune,"]`).click();
    await waitVisible(c, tid(Testids.bookDetail.title), '/book (second visit)');
    const bookTitle = await c.page.locator(tid(Testids.bookDetail.title)).innerText();
    expect(bookTitle.trim() === 'Dune', `/book: expected Dune to open normally the second time, found ${q(bookTitle)}`);
    onlyPlanted();
  },
});

register({
  name: 'db-open-failure',
  suite: 'p09',
  desc: 'E2E database faults: a failed migration and a failed open each show "I couldn\'t open your library" with concerned Booky, the error and Try again (page gates run on it), and Try again opens the Shelf',
  async run(c) {
    const onlyPlanted = allowOnlyPlantedErrors(c);
    for (const [fault, message] of [
      ['migrate', 'E2E: a simulated migration failure'],
      ['open', 'E2E: a simulated failure opening the database'],
    ]) {
      const where = `/?e2e-db-fault=${fault}`;
      await c.page.goto(c.url(where), { waitUntil: 'load' });
      await waitVisible(c, tid(Testids.dbError.root), where);
      await waitVisible(c, tid(Testids.pageState.error), where);
      const title = await c.page.locator(tid(Testids.dbError.title)).innerText();
      expect(title.trim() === 'I couldn’t open your library' || title.trim() === "I couldn't open your library", `${where}: expected ${q("I couldn't open your library")}, found ${q(title)}`);
      const text = await c.page.locator(tid(Testids.dbError.root)).innerText();
      expect(text.includes(message), `${where}: expected the error ${q(message)} on the screen, found ${q(text)}`);
      expect((await c.page.locator(tid(Testids.dbError.root)).locator('[role="img"][aria-label^="Booky"]').count()) === 1, `${where}: expected a concerned Booky`);
      await c.checkGates(`${where} (database error)`);
      await c.snap(`db-error-${fault}`);
      await c.page.locator(tid(Testids.dbError.retry)).click();
      await waitVisible(c, tid(Testids.home.title), `${where} -> Try again`);
      expect((await c.page.locator(tid(Testids.dbError.root)).count()) === 0, `${where}: expected the error screen gone after Try again`);
    }
    await c.checkGates('/ (after recovering)');
    onlyPlanted();
  },
});

register({
  name: 'db-export-file',
  suite: 'p09',
  desc: 'The recovery screen\'s "Save a copy of the library file": with no library yet it says there is nothing to save; after loading "demo", a failed migration still lets the raw database be downloaded as myshelf-library-<date>.db, a real SQLite file holding the 12 books, and Try again opens the same library',
  async run(c) {
    const onlyPlanted = allowOnlyPlantedErrors(c);
    const D = Testids.dbError;

    // A browser that has never stored a library has nothing to save.
    await c.page.goto(c.url('/?e2e-db-fault=open'), { waitUntil: 'load' });
    await waitVisible(c, tid(D.root), '/?e2e-db-fault=open');
    const button = c.page.locator(tid(D.export));
    const name = (await button.getAttribute('aria-label')) ?? (await button.innerText());
    expect(name.trim() === 'Save a copy of the library file', `/?e2e-db-fault=open: expected the button ${q('Save a copy of the library file')}, found ${q(name)}`);
    await button.click();
    await waitVisible(c, tid(D.exportStatus), '/?e2e-db-fault=open (export)');
    const none = await c.page.locator(tid(D.exportStatus)).innerText();
    expect(none.includes("There's no library file on this device yet"), `/?e2e-db-fault=open: expected ${q('nothing to save')}, found ${q(none)}`);

    // A library that will not migrate can still be saved, whole.
    await openFixture(c, 'demo', '/');
    await waitForCount(c, tid(Testids.home.row), 12, '/ (demo)');
    const where = '/?e2e-db-fault=migrate';
    await c.page.goto(c.url(where), { waitUntil: 'load' });
    await waitVisible(c, tid(D.root), where);
    await c.checkGates(`${where} (recovery screen)`);
    const pending = c.page.waitForEvent('download', { timeout: 15_000 });
    await c.page.locator(tid(D.export)).click();
    let file;
    try {
      file = await pending;
    } catch {
      expect(false, `${where}: expected a download after "Save a copy of the library file", none came`);
    }
    const fileName = file.suggestedFilename();
    expect(/^myshelf-library-\d{4}-\d{2}-\d{2}\.db$/.test(fileName), `${where}: expected myshelf-library-YYYY-MM-DD.db, found ${q(fileName)}`);
    const path = join(c.runDir, fileName);
    await file.saveAs(path);
    const head = (await readFile(path)).subarray(0, 16).toString('latin1');
    expect(head === 'SQLite format 3\0', `${where}: expected a SQLite file, found the header ${q(head)}`);
    const db = new DatabaseSync(path, { readOnly: true });
    const books = (db.prepare('SELECT count(*) AS n FROM books').get() as { n: number }).n;
    const dune = db.prepare("SELECT count(*) AS n FROM books WHERE title = 'Dune'").get() as { n: number };
    db.close();
    expect(books === 12 && dune.n === 1, `${where}: expected the file to hold the 12 books with Dune, found ${books} books`);
    await waitVisible(c, tid(D.exportStatus), `${where} (exported)`);
    const status = await c.page.locator(tid(D.exportStatus)).innerText();
    expect(status.includes(`Downloaded ${fileName}.`), `${where}: expected ${q(`Downloaded ${fileName}.`)}, found ${q(status)}`);
    await c.checkGates(`${where} (exported)`);
    await c.snap('db-exported');

    await c.page.locator(tid(D.retry)).click();
    await waitForCount(c, tid(Testids.home.row), 12, `${where} -> Try again`);
    onlyPlanted();
  },
});
