import { Testids, tid } from '../selectors.ts';
import { openFixture, rowNames, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const row = tid(Testids.home.row);
const f = Testids.bookForm;
const d = Testids.bookDetail;

async function textOf(c: Context, selector: string): Promise<string> {
  return (await c.page.locator(selector).first().innerText()).trim();
}

/** The data-testid of the focused element (or its tag). */
async function focused(c: Context): Promise<string> {
  return c.page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return '';
    const label = el.getAttribute('aria-label') || el.getAttribute('role') || (el as HTMLElement).innerText?.slice(0, 30) || '';
    return el.getAttribute('data-testid') || `${el.tagName}${label ? ` "${label}"` : ''}${el === document.body ? ' (body)' : ''}`;
  });
}

async function openRow(c: Context, title: string): Promise<string> {
  await c.page.locator(`${row}[aria-label^="${title},"]`).click();
  const path = await waitForPath(c, /^\/book\/\d+$/, `/ -> ${title}`);
  await waitVisible(c, tid(d.title), path);
  return path;
}

register({
  name: 'book-add-manual',
  suite: 'core',
  desc: 'Empty shelf -> add a book by hand (title, author, year, genre) -> the detail page shows it with a Saved snackbar -> back -> one row',
  async run(c) {
    await openFixture(c, 'empty', '/');
    await c.page.locator(tid(Testids.home.addButton)).click();
    await waitForPath(c, '/book/new', '/ -> Add manually');
    await waitVisible(c, tid(f.title), '/book/new');
    await c.checkGates('/book/new');

    await c.page.locator(tid(f.title)).fill('The Hobbit');
    await c.page.locator(tid(f.authorInput)).fill('J. R. R. Tolkien');
    await c.page.locator(tid(f.authorInput)).press('Enter');
    await waitForCount(c, tid(f.authorChip), 1, '/book/new author');
    await c.page.locator(tid(f.year)).fill('1937');
    await c.page.locator(tid(f.genreInput)).fill('Fantasy');
    await c.page.locator(tid(f.genreInput)).press('Enter');
    await waitForCount(c, tid(f.genreChip), 1, '/book/new genre');
    await c.snap('book-form-filled');

    await c.page.locator(tid(f.save)).click();
    const path = await waitForPath(c, /^\/book\/\d+$/, '/book/new -> save');
    await waitVisible(c, tid(d.title), path);
    const checks: [string, string][] = [
      [tid(d.title), 'The Hobbit'],
      [tid(d.authors), 'J. R. R. Tolkien'],
      [tid(d.callNumber), 'FIC TOL 1937'],
    ];
    for (const [sel, want] of checks) {
      const got = await textOf(c, sel);
      expect(got === want, `${path}: expected ${sel} ${q(want)}, found ${q(got)}`);
    }
    const genres = await textOf(c, tid(d.genres));
    expect(genres.includes('Fantasy'), `${path}: expected the genre Fantasy, found ${q(genres)}`);
    await waitVisible(c, tid(Testids.snackbar.root), path);
    const snack = await textOf(c, tid(Testids.snackbar.root));
    expect(snack.startsWith('Saved'), `${path}: expected a "Saved" snackbar, found ${q(snack)}`);
    await c.checkGates(`${path} (after save)`);
    await c.snap('book-added');

    await c.page.locator(tid(d.back)).click();
    await waitForPath(c, '/', `${path} -> back`);
    await waitForCount(c, row, 1, '/ after adding');
    const names = await rowNames(c);
    expect(names[0] === 'The Hobbit, by J. R. R. Tolkien, 1937', `/: expected the new row ${q('The Hobbit, by J. R. R. Tolkien, 1937')}, found ${q(names[0])}`);
  },
});

register({
  name: 'book-add-invalid-isbn',
  suite: 'p01',
  desc: 'An ISBN with a bad check digit blocks saving: the error summary shows, the field is marked invalid and focused, and the form stays open',
  async run(c) {
    await openFixture(c, 'empty', '/book/new');
    await c.page.locator(tid(f.title)).fill('A Mystery');
    await c.page.locator(tid(f.isbn)).fill('9780000000000');
    await c.page.locator(tid(f.save)).click();
    await waitVisible(c, tid(f.error), '/book/new (save)');
    const summary = await textOf(c, tid(f.error));
    expect(summary.includes('ISBN'), `/book/new: expected the error summary to name the ISBN field, found ${q(summary)}`);
    expect((await c.page.locator(tid(f.error)).getAttribute('role')) === 'alert', `/book/new: expected ${tid(f.error)} to be role=alert`);
    const invalid = await c.page.locator(tid(f.isbn)).getAttribute('aria-invalid');
    expect(invalid === 'true', `/book/new: expected the ISBN field aria-invalid="true", found ${q(invalid)}`);
    const body = await c.page.locator('main').innerText();
    expect(body.includes('check the last digit'), `/book/new: expected the inline hint about the last digit, found ${q(body.slice(0, 300))}`);
    // Keyboard and screen-reader users land on the field to fix.
    await c.page.waitForFunction((id) => document.activeElement?.getAttribute('data-testid') === id, f.isbn, { timeout: 5_000 }).catch(() => {});
    const now = await focused(c);
    expect(now === f.isbn, `/book/new: expected focus on ${q(f.isbn)} after the failed save, found ${q(now)}`);
    expect(new URL(c.page.url()).pathname === '/book/new', `/book/new: expected to stay on the form, now on ${q(c.page.url())}`);
    await c.checkGates('/book/new (invalid ISBN)');
    await c.snap('book-form-invalid-isbn');
  },
});

register({
  name: 'book-edit',
  suite: 'p01',
  desc: 'Fixture "demo": open the first book -> Edit -> change the year -> save -> the detail page shows the new year and call number',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    const path = await openRow(c, 'The Colour of Magic');
    await c.page.locator(tid(d.edit)).click();
    await waitForPath(c, `${path}/edit`, `${path} -> Edit`);
    await waitVisible(c, tid(f.year), `${path}/edit`);
    const year = await c.page.locator(tid(f.year)).inputValue();
    expect(year === '1983', `${path}/edit: expected the year field to hold 1983, found ${q(year)}`);
    await c.checkGates(`${path}/edit`);
    await c.snap('book-form-edit');

    await c.page.locator(tid(f.year)).fill('1984');
    await c.page.locator(tid(f.save)).click();
    await waitForPath(c, path, `${path}/edit -> save`);
    await c.page.waitForFunction((sel) => document.querySelector(sel)?.textContent?.includes('1984'), tid(d.callNumber), { timeout: 10_000 }).catch(() => {});
    const call = await textOf(c, tid(d.callNumber));
    expect(call === 'FIC PRA 1984', `${path}: expected the call number ${q('FIC PRA 1984')}, found ${q(call)}`);
    const facts = await textOf(c, tid(d.facts));
    expect(facts.includes('1984'), `${path}: expected the facts to show 1984, found ${q(facts)}`);
    const snack = await textOf(c, tid(Testids.snackbar.root));
    expect(snack === 'Saved your changes', `${path}: expected the snackbar ${q('Saved your changes')}, found ${q(snack)}`);
    await c.snap('book-edited');
  },
});

register({
  name: 'book-delete-undo',
  suite: 'p01',
  desc: 'Fixture "demo": delete Dune from its page (menu -> confirm, with the on-loan warning) -> 11 rows -> Undo -> 12 rows and Dune is back',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, row, 12, '/');
    const path = await openRow(c, 'Dune');
    await c.snap('book-detail');

    const more = c.page.locator(tid(d.more));
    await more.click();
    await waitVisible(c, tid(Testids.menu.root), `${path} (menu)`);
    expect((await c.page.locator(tid(Testids.menu.root)).getAttribute('role')) === 'menu', `${path}: expected the overflow to be role=menu`);
    await c.page.locator(tid(d.delete)).click();
    const dialog = tid(Testids.dialog.root);
    await waitVisible(c, dialog, `${path} (delete)`);
    const text = await textOf(c, dialog);
    expect(text.includes('Remove “Dune” from your shelf?'), `${path}: expected the dialog to name the book, found ${q(text)}`);
    expect(text.includes('on loan to Sam'), `${path}: expected the open-loan warning, found ${q(text)}`);
    expect((await c.page.locator(dialog).getAttribute('role')) === 'alertdialog', `${path}: expected the dialog to be role=alertdialog`);
    const inside = await c.page.evaluate((sel) => !!document.querySelector(sel)?.contains(document.activeElement), dialog);
    expect(inside, `${path}: expected focus inside the dialog while it is open, found ${q(await focused(c))}`);
    await c.checkGates(`${path} (delete dialog)`);
    await c.snap('delete-confirm');

    await c.page.locator(tid(Testids.dialog.confirm)).click();
    await waitForPath(c, '/', `${path} -> delete`);
    await waitForCount(c, row, 11, '/ after delete');
    expect(!(await rowNames(c)).some((n) => n.startsWith('Dune,')), '/ after delete: Dune is still listed');
    await waitVisible(c, tid(Testids.snackbar.action), '/ after delete');
    const snack = await textOf(c, tid(Testids.snackbar.root));
    expect(snack.startsWith('Removed “Dune”'), `/ after delete: expected the snackbar to say Dune was removed, found ${q(snack)}`);
    await c.checkGates('/ (undo snackbar)');
    await c.snap('deleted-undo');

    await c.page.locator(tid(Testids.snackbar.action)).click();
    await waitForCount(c, row, 12, '/ after undo');
    expect((await rowNames(c)).includes('Dune, by Frank Herbert, 1965, on loan'), '/ after undo: expected Dune back, still on loan');
    await c.snap('undone');
  },
});

register({
  name: 'book-form-discard',
  suite: 'p01',
  desc: 'Leaving a form with unsaved changes asks first: Escape keeps editing and returns focus to Cancel; Discard leaves without saving',
  async run(c) {
    await openFixture(c, 'empty', '/');
    await c.page.locator(tid(Testids.home.addButton)).click();
    await waitForPath(c, '/book/new', '/ -> Add manually');
    await waitVisible(c, tid(f.title), '/book/new');
    await c.page.locator(tid(f.title)).fill('Half typed');

    await c.page.locator(tid(f.cancel)).click();
    const dialog = tid(Testids.dialog.root);
    await waitVisible(c, dialog, '/book/new (cancel)');
    const text = await textOf(c, dialog);
    expect(text.includes('Discard your changes?'), `/book/new: expected the discard question, found ${q(text)}`);
    await c.checkGates('/book/new (discard dialog)');
    await c.snap('discard-dialog');

    await c.page.keyboard.press('Escape');
    await c.page.locator(dialog).waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
    expect((await c.page.locator(dialog).count()) === 0, '/book/new: Escape should close the dialog');
    expect(new URL(c.page.url()).pathname === '/book/new', '/book/new: Escape should keep the form open');
    const value = await c.page.locator(tid(f.title)).inputValue();
    expect(value === 'Half typed', `/book/new: the typed title should survive, found ${q(value)}`);
    const back = await focused(c);
    expect(back === f.cancel, `/book/new: expected focus back on ${q(f.cancel)} after closing the dialog, found ${q(back)}`);

    await c.page.locator(tid(f.cancel)).click();
    await waitVisible(c, dialog, '/book/new (cancel again)');
    await c.page.locator(tid(Testids.dialog.confirm)).click();
    await waitForPath(c, '/', '/book/new -> Discard');
    await waitVisible(c, tid(Testids.emptyState.root), '/ after discarding');
  },
});

register({
  name: 'book-detail-missing',
  suite: 'p01',
  desc: 'An unknown book id shows the error state: h1 "Book not found" with Booky and a way back (pagestate error-marker waived: the error page is the point)',
  async run(c) {
    c.gates.waive('pagestate', 'error-marker', 'this journey opens a missing book on purpose; the error state is what it checks');
    await c.goto('/book/99999');
    await waitVisible(c, tid(Testids.pageState.error), '/book/99999');
    const title = c.page.locator(tid(Testids.bookMissing.title));
    const info = await title.evaluate((el) => ({ tag: el.tagName, level: el.getAttribute('aria-level'), text: (el as HTMLElement).innerText }));
    expect(info.text === 'Book not found', `/book/99999: expected the h1 ${q('Book not found')}, found ${q(info.text)}`);
    expect(info.tag === 'H1' || info.level === '1', `/book/99999: expected the title to be the h1, found <${info.tag} aria-level=${info.level}>`);
    const booky = c.page.locator(tid(Testids.bookMissing.root)).locator('[role="img"][aria-label^="Booky"]');
    expect((await booky.count()) === 1, '/book/99999: expected a concerned Booky');
    await c.page.locator(tid(Testids.bookMissing.back)).click();
    await waitForPath(c, '/', '/book/99999 -> Back to shelf');
  },
});
