// The scan flow on the web harness (P03-07..P03-13): typed ISBN or cover text
// stands in for the camera and the cover reader, and drives the same scan
// session, edition picker, duplicate check and save. APIs are mocked.
import { Testids, tid } from '../selectors.ts';
import { openFixture, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expectRealCover } from './lookup.journey.ts';
import { expect, q, register, type Context } from './registry.ts';

const s = Testids.scan;
const p = Testids.picker;
const d = Testids.bookDetail;

async function textOf(c: Context, selector: string): Promise<string> {
  return (await c.page.locator(selector).first().innerText()).trim();
}

async function typeIsbn(c: Context, isbn: string): Promise<void> {
  await c.page.locator(tid(s.webIsbn)).fill(isbn);
  await c.page.locator(tid(s.webIsbnSubmit)).click();
}

/** Picker -> "This is my edition" -> the new book's page, with Booky's "Shelved!" and the real cover. */
async function confirmAndLand(c: Context, where: string): Promise<string> {
  await c.page.locator(tid(p.confirm)).click();
  const path = await waitForPath(c, /^\/book\/\d+$/, `${where} -> confirm`);
  await waitVisible(c, tid(d.title), path);
  return path;
}

register({
  name: 'scan-web-isbn-single',
  suite: 'core',
  desc: 'Empty shelf -> Scan -> type ISBN 9780552166591 (the barcode stand-in) -> Booky looks it up -> picker with the one edition pre-selected -> This is my edition -> the book page with its real cover and Booky’s excited "Shelved!"',
  async run(c) {
    await openFixture(c, 'empty', '/scan');
    await waitVisible(c, tid(s.webIsbn), '/scan');
    await c.checkGates('/scan');
    await c.snap('scan-screen');
    await typeIsbn(c, '9780552166591');
    const path = await waitForPath(c, '/scan/pick', '/scan -> lookup');
    await waitVisible(c, tid(p.edition), path);
    const editions = c.page.locator(tid(p.edition));
    expect((await editions.count()) === 1, `${path}: expected exactly one edition, found ${await editions.count()}`);
    expect((await c.page.locator(tid(p.work)).count()) === 0, `${path}: expected no work grouping for a single ISBN result`);
    const checked = await editions.first().getAttribute('aria-checked');
    expect(checked === 'true', `${path}: expected the single edition pre-selected, found aria-checked=${q(checked)}`);
    const label = (await editions.first().getAttribute('aria-label')) ?? '';
    expect(label.includes('Corgi Books') && label.includes('ISBN 9780552166591'), `${path}: expected the edition to read its publisher and ISBN, found ${q(label)}`);
    expect(!(await c.page.locator(tid(p.confirm)).isDisabled()), `${path}: expected "This is my edition" enabled with a selection`);
    await expectRealCover(c, tid(p.edition), path);
    await c.checkGates(path);
    await c.snap('picker-single');

    const book = await confirmAndLand(c, path);
    const title = await textOf(c, tid(d.title));
    expect(title === 'The Colour of Magic', `${book}: expected the saved title, found ${q(title)}`);
    // The tab shell underneath keeps its own (hidden) tip host: look at the visible one.
    await waitVisible(c, `${tid(Testids.booky.bubble)}:visible`, book);
    const bubble = await textOf(c, `${tid(Testids.booky.bubbleText)}:visible`);
    expect(bubble.startsWith('Shelved! That’s 1 book'), `${book}: expected Booky’s "Shelved! That’s 1 book.", found ${q(bubble)}`);
    await expectRealCover(c, tid(d.root), book);
    await c.checkGates(`${book} (saved from a scan)`);
    await c.snap('scan-saved');
  },
});

register({
  name: 'scan-web-cover-text',
  suite: 'p03',
  desc: 'Cover mode -> type "THE COLOUR OF MAGIC TERRY PRATCHETT" -> picker groups the works -> open The Colour of Magic -> its editions load (skeletons first) -> filter to paperback -> choose the 1990 Corgi -> saved with series Discworld #1 and a real cover',
  async run(c) {
    await openFixture(c, 'empty', '/scan');
    await c.page.locator(tid(s.modeCover)).click();
    await waitVisible(c, tid(s.webText), '/scan (cover mode)');
    await c.page.locator(tid(s.webText)).fill('THE COLOUR OF MAGIC TERRY PRATCHETT');
    await c.page.locator(tid(s.webTextSubmit)).click();
    const path = await waitForPath(c, '/scan/pick', '/scan -> cover search');
    await waitVisible(c, tid(p.work), path);
    const works = await c.page.locator(tid(p.work)).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    expect(works.length > 1, `${path}: expected several works to choose from, found ${q(works)}`);
    expect(works[0]!.startsWith('The Colour of Magic, by Terry Pratchett'), `${path}: expected The Colour of Magic first, found ${q(works[0])}`);
    expect((await c.page.locator(tid(p.confirm)).isDisabled()), `${path}: expected "This is my edition" disabled before a choice`);
    await c.checkGates(`${path} (works)`);
    await c.snap('picker-works');

    const first = c.page.locator(tid(p.work)).first();
    await first.click();
    expect((await first.getAttribute('aria-expanded')) === 'true', `${path}: expected the work to report aria-expanded=true once open`);
    const corgi = c.page.locator(`${tid(p.edition)}[aria-label*="Corgi, 1990"]`);
    await waitVisible(c, `${tid(p.edition)}[aria-label*="Corgi, 1990"]`, `${path} (editions)`);
    await waitVisible(c, tid(p.filterFormat), `${path} (filters)`);
    await c.page.locator(`${tid(p.filterFormat)} [role="radio"]`, { hasText: 'Paperback' }).click();
    const shown = await c.page.locator(tid(p.edition)).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    expect(shown.length > 0 && shown.every((l) => l.startsWith('Paperback')), `${path}: expected only paperbacks after the filter, found ${q(shown)}`);
    await corgi.click();
    expect((await corgi.getAttribute('aria-checked')) === 'true', `${path}: expected the Corgi edition checked`);
    await c.checkGates(`${path} (editions)`);
    await c.snap('picker-editions');

    const book = await confirmAndLand(c, path);
    await waitVisible(c, tid(d.series), book);
    const series = await textOf(c, tid(d.series));
    expect(series.includes('Discworld') && series.includes('Book 1'), `${book}: expected the series Discworld, book 1, found ${q(series)}`);
    const facts = await textOf(c, tid(d.facts));
    expect(facts.includes('Corgi') && facts.includes('1990') && facts.includes('9780552124751'), `${book}: expected the Corgi 1990 edition’s facts, found ${q(facts)}`);
    await expectRealCover(c, tid(d.root), book);
  },
});

register({
  name: 'scan-not-found-manual',
  suite: 'p03',
  desc: 'An ISBN no catalogue knows -> Booky "couldn’t find that one" -> Add it by hand -> the add form starts with the ISBN, nothing saved yet',
  async run(c) {
    await openFixture(c, 'empty', '/scan');
    await waitVisible(c, tid(s.webIsbn), '/scan');
    await typeIsbn(c, '9791099999993');
    await waitVisible(c, tid(s.notFound), '/scan (not found)');
    await c.checkGates('/scan (not found)');
    await c.snap('scan-not-found');
    await c.page.locator(tid(s.addManually)).click();
    await waitForPath(c, '/book/new', '/scan -> Add it by hand');
    await waitVisible(c, tid(Testids.bookForm.isbn), '/book/new');
    const isbn = await c.page.locator(tid(Testids.bookForm.isbn)).inputValue();
    expect(isbn === '9791099999993', `/book/new: expected the scanned ISBN in the form, found ${q(isbn)}`);
    await c.checkGates('/book/new (prefilled from a scan)');
    await c.page.locator(tid(Testids.bookForm.cancel)).click();
    await waitForPath(c, '/scan', '/book/new -> cancel');
  },
});

register({
  name: 'scan-duplicate',
  suite: 'p03',
  desc: 'Fixture "demo": scan Pride and Prejudice’s ISBN -> "Already on your shelf" with the existing card -> Add another copy -> 13 rows on the Shelf',
  async run(c) {
    await openFixture(c, 'demo', '/scan');
    await waitVisible(c, tid(s.webIsbn), '/scan');
    await typeIsbn(c, '9780141439518');
    const path = await waitForPath(c, '/scan/pick', '/scan -> lookup');
    await waitVisible(c, tid(p.edition), path);
    await c.page.locator(tid(p.confirm)).click();
    await waitVisible(c, tid(Testids.duplicate.sheet), `${path} (duplicate)`);
    const sheet = await textOf(c, tid(Testids.duplicate.sheet));
    expect(sheet.includes('Already on your shelf') && sheet.includes('Pride and Prejudice'), `${path}: expected the duplicate sheet to show the existing copy, found ${q(sheet)}`);
    expect((await c.page.locator(tid(Testids.duplicate.sheet)).getAttribute('role')) === 'dialog', `${path}: expected the sheet to be role=dialog`);
    await c.checkGates(`${path} (duplicate sheet)`);
    await c.snap('duplicate-sheet');
    await c.page.locator(tid(Testids.duplicate.addCopy)).click();
    const book = await waitForPath(c, /^\/book\/\d+$/, `${path} -> add another copy`);
    await waitVisible(c, tid(d.title), book);
    await c.goto('/');
    await waitForCount(c, tid(Testids.home.row), 13, '/ after adding a copy');
  },
});

register({
  name: 'scan-batch-review',
  suite: 'p03',
  desc: '"Scan several": type 3 ISBNs -> tray count 3 -> Review -> drop one -> Save 2 books -> 2 new rows on the Shelf, and the tray is empty',
  async run(c) {
    await openFixture(c, 'empty', '/scan');
    await c.page.locator(tid(s.batchToggle)).click();
    await waitVisible(c, tid(s.trayCount), '/scan (batch)');
    for (const [i, isbn] of ['9780552166591', '9780553418026', '9782070612758'].entries()) {
      await typeIsbn(c, isbn);
      await c.page.waitForFunction(([sel, n]) => document.querySelector(sel as string)?.textContent === String(n), [tid(s.trayCount), i + 1] as const, { timeout: 15_000 });
    }
    expect((await textOf(c, tid(s.trayCount))) === '3', '/scan: expected 3 books in the tray');
    await c.checkGates('/scan (tray)');
    await c.snap('scan-tray');
    await c.page.locator(tid(s.reviewOpen)).click();
    await waitForPath(c, '/scan/review', '/scan -> review');
    await waitForCount(c, tid(Testids.scanReview.item), 3, '/scan/review');
    await c.checkGates('/scan/review');
    await c.snap('scan-review');
    await c.page.locator(tid(Testids.scanReview.drop)).nth(1).click();
    await waitForCount(c, tid(Testids.scanReview.item), 2, '/scan/review (dropped one)');
    const save = await textOf(c, tid(Testids.scanReview.saveAll));
    expect(save.endsWith('Save 2 books'), `/scan/review: expected ${q('Save 2 books')}, found ${q(save)}`);
    await c.page.locator(tid(Testids.scanReview.saveAll)).click();
    await waitForPath(c, '/', '/scan/review -> save all');
    await waitForCount(c, tid(Testids.home.row), 2, '/ after saving the tray');
    await c.page.locator(tid(Testids.tabs.scan)).click();
    await waitVisible(c, tid(s.trayCount), '/scan (after saving)');
    expect((await textOf(c, tid(s.trayCount))) === '0', '/scan: expected the tray to be empty after saving');
  },
});

register({
  name: 'scan-e2e-inject',
  suite: 'p03',
  desc: 'The E2E deep link /e2e/scan?isbn=9780553418026 hands a scan to the Scan tab exactly as the camera would -> the picker shows The Martian',
  async run(c) {
    await openFixture(c, 'empty', '/scan');
    await c.goto('/e2e/scan?isbn=9780553418026');
    const path = await waitForPath(c, '/scan/pick', '/e2e/scan -> picker');
    await waitVisible(c, tid(p.edition), path);
    const label = (await c.page.locator(tid(p.edition)).first().getAttribute('aria-label')) ?? '';
    expect(label.includes('The Martian'), `${path}: expected The Martian, found ${q(label)}`);
  },
});
