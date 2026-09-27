// Online lookup on the add form (P02-11, P02-12). The book APIs are answered
// by the recorded fixtures (--mock-api); covers by the generated test JPEGs.
import { Testids, tid } from '../selectors.ts';
import { coverState, openFixture, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const l = Testids.lookup;
const f = Testids.bookForm;
const d = Testids.bookDetail;

async function textOf(c: Context, selector: string): Promise<string> {
  return (await c.page.locator(selector).first().innerText()).trim();
}

/** Waits until the element's text satisfies `test`. */
async function waitForText(c: Context, selector: string, test: (s: string) => boolean, where: string, timeout = 15_000): Promise<string> {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeout) {
    last = (await c.page.locator(selector).first().innerText().catch(() => '')).trim();
    if (test(last)) return last;
    // Polling: the test is a Node-side predicate, so it cannot run in waitForFunction.
    await c.page.waitForTimeout(100);
  }
  expect(false, `${where}: ${selector} never showed the expected text; last saw ${q(last)}`);
  return last;
}

/**
 * Asserts that the real cover renders inside `scope` (an <img> with pixels)
 * and the generated fallback is absent. Covers are stored after the save
 * (the cover chain fetches a few candidates), so this waits for them.
 */
export async function expectRealCover(c: Context, scope: string, where: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  let state = await coverState(c, scope);
  while ((state.loaded < 1 || state.fallbacks > 0) && Date.now() < deadline) {
    // Polling until the deadline: cover images load (or fall back) with no event to wait on.
    await c.page.waitForTimeout(250);
    state = await coverState(c, scope);
  }
  expect(state.loaded >= 1, `${where}: expected a real cover image with pixels in ${scope}, found ${q(state)}`);
  expect(state.fallbacks === 0, `${where}: expected no generated fallback cover in ${scope}, found ${state.fallbacks}`);
}

async function lookUpIsbn(c: Context, isbn: string): Promise<void> {
  await c.page.locator(tid(l.isbnInput)).fill(isbn);
  await c.page.locator(tid(l.isbnSubmit)).click();
}

register({
  name: 'lookup-isbn-found',
  suite: 'core',
  desc: 'Empty shelf -> Add -> look up ISBN 9780552166591 -> one candidate with its real cover -> choose -> form filled (title, author, year, genre, series, real cover) -> save -> detail shows it all with the real cover',
  async run(c) {
    await openFixture(c, 'empty', '/book/new');
    await waitVisible(c, tid(l.isbnInput), '/book/new');
    await lookUpIsbn(c, '9780552166591');
    await waitForCount(c, tid(l.candidate), 1, '/book/new lookup');
    const label = (await c.page.locator(tid(l.candidate)).getAttribute('aria-label')) ?? '';
    expect(
      label.startsWith('The Colour of Magic, by Terry Pratchett, 1985, Corgi Books') && label.endsWith('from Open Library'),
      `/book/new: expected the candidate to read "The Colour of Magic, by Terry Pratchett, 1985, Corgi Books, … from Open Library", found ${q(label)}`,
    );
    await expectRealCover(c, tid(l.results), '/book/new candidate');
    await c.checkGates('/book/new (candidates)');
    await c.snap('lookup-candidates');

    await c.page.locator(tid(l.candidate)).click();
    await waitVisible(c, tid(l.chosen), '/book/new (chosen)');
    const fields: [string, string][] = [
      [f.title, 'The Colour of Magic'],
      [f.year, '1985'],
      [f.isbn, '9780552166591'],
      [Testids.seriesInput.search, 'Discworld'],
      [Testids.seriesInput.position, '1'],
    ];
    for (const [id, want] of fields) {
      const got = await c.page.locator(tid(id)).inputValue();
      expect(got === want, `/book/new: expected ${id} to be filled with ${q(want)}, found ${q(got)}`);
    }
    const authors = await c.page.locator(tid(f.authorChip)).allInnerTexts();
    expect(authors.some((a) => a.includes('Terry Pratchett')), `/book/new: expected the author chip Terry Pratchett, found ${q(authors)}`);
    const genres = await c.page.locator(tid(f.genreChip)).allInnerTexts();
    expect(genres.some((g) => g.includes('Fantasy')), `/book/new: expected the genre Fantasy, found ${q(genres)}`);
    const summary = await c.page.locator(tid(f.summary)).inputValue();
    expect(summary.length > 40, `/book/new: expected a summary, found ${q(summary)}`);
    await expectRealCover(c, tid(f.root), '/book/new (form)');
    await c.checkGates('/book/new (filled from lookup)');
    await c.snap('lookup-form-filled');

    await c.page.locator(tid(f.save)).click();
    const path = await waitForPath(c, /^\/book\/\d+$/, '/book/new -> save');
    await waitVisible(c, tid(d.title), path);
    const title = await textOf(c, tid(d.title));
    expect(title === 'The Colour of Magic', `${path}: expected the title ${q('The Colour of Magic')}, found ${q(title)}`);
    const series = await textOf(c, tid(d.series));
    expect(series.includes('Discworld') && series.includes('Book 1'), `${path}: expected the series Discworld, book 1, found ${q(series)}`);
    const detailGenres = await textOf(c, tid(d.genres));
    expect(detailGenres.includes('Fantasy'), `${path}: expected the genre Fantasy, found ${q(detailGenres)}`);
    await expectRealCover(c, tid(d.root), path);
    await c.checkGates(`${path} (saved from lookup)`);
    await c.snap('lookup-saved');
  },
});

register({
  name: 'lookup-isbn-not-found',
  suite: 'p02',
  desc: 'An ISBN no catalogue knows (Open Library 404, marked expected) -> Booky "couldn’t find that one" -> Add it by hand keeps the ISBN and focuses the title',
  async run(c) {
    await openFixture(c, 'empty', '/book/new');
    await waitVisible(c, tid(l.isbnInput), '/book/new');
    await lookUpIsbn(c, '9791099999993');
    await waitVisible(c, tid(l.noResults), '/book/new (not found)');
    const text = await textOf(c, tid(l.noResults));
    expect(text.includes('I couldn’t find that one'), `/book/new: expected Booky to say it couldn't find it, found ${q(text)}`);
    await c.checkGates('/book/new (no results)');
    await c.snap('lookup-not-found');
    await c.page.locator(tid(l.addManually)).click();
    await c.page.waitForFunction((id) => document.activeElement?.getAttribute('data-testid') === id, f.title, { timeout: 5_000 }).catch(() => {});
    const focused = await c.page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? '');
    expect(focused === f.title, `/book/new: expected focus on the title after "Add it by hand", found ${q(focused)}`);
    const isbn = await c.page.locator(tid(f.isbn)).inputValue();
    expect(isbn === '9791099999993', `/book/new: expected the ISBN kept in the form, found ${q(isbn)}`);
  },
});

register({
  name: 'lookup-search-title',
  suite: 'p02',
  desc: 'Search online for "colour of magic pratchett" -> at least one candidate, the first is The Colour of Magic with a real cover',
  async run(c) {
    await openFixture(c, 'empty', '/book/new');
    await waitVisible(c, tid(l.searchInput), '/book/new');
    await c.page.locator(tid(l.searchInput)).fill('colour of magic pratchett');
    await c.page.locator(tid(l.searchSubmit)).click();
    await waitVisible(c, tid(l.candidate), '/book/new search');
    const labels = await c.page.locator(tid(l.candidate)).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    expect(labels.length >= 1, `/book/new: expected at least one candidate, found ${labels.length}`);
    expect(labels[0]!.startsWith('The Colour of Magic, by Terry Pratchett'), `/book/new: expected The Colour of Magic first, found ${q(labels[0])}`);
    await expectRealCover(c, `${tid(l.results)} ${tid(l.candidate)}`, '/book/new first result');
    await c.checkGates('/book/new (search results)');
    await c.snap('lookup-search-results');
  },
});

register({
  name: 'lookup-provider-partial-failure',
  suite: 'p02',
  desc: 'Google Books answers 500 (marked expected) for Moving Pictures -> the Open Library result still shows with a note, and no error state',
  async run(c) {
    await openFixture(c, 'empty', '/book/new');
    await waitVisible(c, tid(l.isbnInput), '/book/new');
    await lookUpIsbn(c, '9780552134637');
    // The HTTP client retries a 5xx three times (1 s, 2 s, 4 s) before giving up on Google Books.
    await waitForText(c, tid(l.results), (t) => t.includes('Moving Pictures'), '/book/new (partial failure)', 25_000);
    const warning = await textOf(c, tid(l.warning));
    expect(warning.includes('Google Books didn’t answer'), `/book/new: expected a note that Google Books didn't answer, found ${q(warning)}`);
    expect((await c.page.locator(tid(l.error)).count()) === 0, '/book/new: expected no lookup error when one catalogue answered');
    expect((await c.page.locator(tid(Testids.pageState.error)).count()) === 0, '/book/new: expected no page-error marker');
    await c.checkGates('/book/new (one provider failed)');
    await c.snap('lookup-partial-failure');
  },
});

register({
  name: 'cover-backfill-mocked',
  suite: 'p02',
  desc: 'A book typed in by hand with an ISBN has no cover; on the next start the tab shell runs the cover backfill, which finds its cover id with the batch ISBN search through the mocked APIs and stores its real cover: the Shelf row shows the image, not the fallback',
  async run(c) {
    await openFixture(c, 'empty', '/book/new');
    await waitVisible(c, tid(f.title), '/book/new');
    await c.page.locator(tid(f.title)).fill('The Colour of Magic');
    await c.page.locator(tid(f.isbn)).fill('9780552166591');
    await c.page.locator(tid(f.save)).click();
    const path = await waitForPath(c, /^\/book\/\d+$/, '/book/new -> save');
    await waitVisible(c, tid(d.title), path);
    const before = await coverState(c, tid(d.root));
    expect(before.images === 0 && before.fallbacks >= 1, `${path}: expected the typed-in book to start with the generated cover, found ${q(before)}`);

    // A fresh start: the tab shell mounts and starts the backfill.
    const lookedUp = c.page.waitForRequest((r) => r.url().startsWith('https://openlibrary.org/search.json?q=isbn') && r.url().includes('9780552166591'), { timeout: 20_000 });
    await c.goto('/');
    try {
      await lookedUp;
    } catch {
      expect(false, '/: expected the cover backfill to ask the mocked Open Library search for the book’s cover id');
    }
    await expectRealCover(c, `${tid(Testids.home.row)}[aria-label^="The Colour of Magic"]`, '/ (after the backfill)');
    await c.snap('cover-backfilled');
  },
});

register({
  name: 'book-refresh-diff',
  suite: 'p02',
  desc: 'Fixture "demo": The Farthest Shore (no summary) -> More -> Refresh details -> field-by-field changes as checkboxes -> keep only the summary ticked -> Update 1 detail -> the detail page shows the summary, nothing else changed',
  async run(c) {
    await openFixture(c, 'demo', '/');
    await waitForCount(c, tid(Testids.home.row), 12, '/');
    await c.page.locator(`${tid(Testids.home.row)}[aria-label^="The Farthest Shore,"]`).click();
    const path = await waitForPath(c, /^\/book\/\d+$/, '/ -> The Farthest Shore');
    await waitVisible(c, tid(d.title), path);
    expect((await c.page.locator(tid(d.summary)).count()) === 0, `${path}: expected no summary before the refresh`);
    const factsBefore = await textOf(c, tid(d.facts));
    await c.page.locator(tid(d.more)).click();
    await c.page.locator(tid(Testids.refresh.open)).click();
    await waitForPath(c, `${path}/refresh`, `${path} -> Refresh details`);
    await waitVisible(c, tid(Testids.refresh.fieldToggle), `${path}/refresh`);
    const rows = c.page.locator(tid(Testids.refresh.fieldToggle));
    const labels = await rows.evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label')}|${e.getAttribute('aria-checked')}`));
    expect(labels.some((x) => x.startsWith('Summary: add') && x.endsWith('|true')), `${path}/refresh: expected "Summary: add" ticked, found ${q(labels)}`);
    expect(labels.some((x) => x.startsWith('Pages: 223 → 214') && x.endsWith('|false')), `${path}/refresh: expected "Pages: 223 → 214" unticked, found ${q(labels)}`);
    await c.checkGates(`${path}/refresh`);
    await c.snap('refresh-diff');

    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      const label = (await row.getAttribute('aria-label')) ?? '';
      if ((await row.getAttribute('aria-checked')) === 'true' && !label.startsWith('Summary')) await row.click();
    }
    const apply = await textOf(c, tid(Testids.refresh.apply));
    expect(apply === 'Update 1 detail', `${path}/refresh: expected the button to say ${q('Update 1 detail')}, found ${q(apply)}`);
    await c.page.locator(tid(Testids.refresh.apply)).click();
    await waitForPath(c, path, `${path}/refresh -> apply`);
    const summary = await waitForText(c, tid(d.summary), (t) => t.startsWith('A young prince joins forces'), path);
    expect(summary.length > 40, `${path}: expected the new summary, found ${q(summary)}`);
    const factsAfter = await textOf(c, tid(d.facts));
    expect(factsAfter === factsBefore, `${path}: expected the other facts unchanged, found ${q(factsAfter)} (was ${q(factsBefore)})`);
    await c.checkGates(`${path} (refreshed)`);
    await c.snap('refresh-applied');
  },
});
