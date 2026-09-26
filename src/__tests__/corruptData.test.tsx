import { screen, waitFor } from 'expo-router/testing-library';

import { type Db } from '@/db';
import { setToday } from '@/domain';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { GroupDetailScreen } from '@/features/groups/GroupDetailScreen';
import { BorrowerScreen } from '@/features/loans/BorrowerScreen';
import { PreferencesScreen } from '@/features/settings/PreferencesScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

/**
 * P09-04: rows a restore of a hand-edited backup, an old bug or a half-written
 * import could leave behind. Nothing here may crash a screen: each one still
 * renders its content (no error boundary), making the best of odd values.
 */
async function corrupt(db: Db): Promise<{ bookId: number; borrowerId: number; groupId: number }> {
  await loadFixture(db, 'demo');
  const book = (await db.get<{ id: number }>("SELECT id FROM books WHERE title = 'Mort'"))!;
  await db.run(
    `UPDATE books SET language = 'zz-not-a-language', publication_year = -99999, page_count = 999999999, cover_uri = 'not a uri at all',
       series_position = -1.5, edition = '', publisher = '', summary = '', notes = '' WHERE id = ?`,
    [book.id],
  );
  // A loan with dates that are not dates (the CHECKs only compare text).
  const loaned = (await db.get<{ id: number }>("SELECT id FROM books WHERE title = 'Good Omens'"))!;
  const borrower = (await db.get<{ id: number }>("SELECT id FROM borrowers WHERE name = 'Sam'"))!;
  await db.run('DELETE FROM loans WHERE book_id = ?', [loaned.id]);
  await db.run("INSERT INTO loans (book_id, borrower_id, lent_on, due_on, note) VALUES (?, ?, 'yesterday', 'zzz', NULL)", [loaned.id, borrower.id]);
  const group = await db.run("INSERT INTO groups (name, colour, icon) VALUES ('Odd group', 'chartreuse', 'dragon')");
  await db.run('INSERT INTO group_books (group_id, book_id, position) VALUES (?, ?, 0)', [group.lastInsertRowId, book.id]);
  // Settings that parse but hold nonsense, and one that does not parse.
  for (const [key, value] of [
    ['shelfSort', '{"sort":"banana","direction":"sideways"}'],
    ['shelfGroupBy', '"planets"'],
    ['shelfViewMode', '"hologram"'],
    ['shelfFilters', '{"genreIds":"all"}'],
    ['dateFormat', '"klingon"'],
    ['loanDays', '"lots"'],
    ['mutedTips', '"none"'],
    ['booky.seen', '42'],
    ['bookyMode', '"loud"'],
    ['appearance', '"sepia"'],
    ['googleBooksEnabled', '{not json'],
  ]) {
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, value]);
  }
  return { bookId: book.id, borrowerId: borrower.id, groupId: group.lastInsertRowId };
}

let db: Db;
let consoleError: jest.SpyInstance;
beforeEach(async () => {
  setToday('2026-06-20');
  db = await createTestDb();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  setToday(null);
  consoleError.mockRestore();
  await db.close();
});

const noBoundary = () => expect(screen.queryByTestId(Testids.errorBoundary.root)).toBeNull();
/** Nothing failed quietly either: no error was logged while the screen loaded. */
const expectNothingLogged = () => expect(consoleError.mock.calls.map((c) => c.map((x: unknown) => (x instanceof Error ? x.message : String(x).slice(0, 200))))).toEqual([]);

describe('screens with corrupt rows (P09-04)', () => {
  it('the Shelf lists every book with the odd settings ignored', async () => {
    await corrupt(db);
    renderApp(db, '/');
    await advance(300);
    expectNothingLogged();
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(12));
    noBoundary();
    expectNothingLogged();
  });

  it('book detail shows the odd book', async () => {
    const { bookId } = await corrupt(db);
    renderApp(db, `/book/${bookId}`, { 'book/[id]': BookDetailScreen });
    expect(await screen.findByTestId(Testids.bookDetail.title)).toHaveTextContent('Mort');
    noBoundary();
    expectNothingLogged();
  });

  it('Loans and the borrower show a loan whose dates are not dates', async () => {
    const { borrowerId } = await corrupt(db);
    renderApp(db, '/loans');
    await advance(300);
    expectNothingLogged();
    await waitFor(() => expect(screen.getAllByTestId(Testids.loans.row).length).toBeGreaterThan(0));
    noBoundary();
    renderApp(db, `/borrower/${borrowerId}`, { 'borrower/[id]': BorrowerScreen });
    expect(await screen.findByText('Sam', { exact: false })).toBeOnTheScreen();
    noBoundary();
    expectNothingLogged();
  });

  it('a group with an unknown colour and icon', async () => {
    const { groupId } = await corrupt(db);
    renderApp(db, `/group/${groupId}`, { 'group/[id]': GroupDetailScreen });
    expect(await screen.findByTestId(Testids.groups.detailTitle)).toHaveTextContent('Odd group');
    noBoundary();
    expectNothingLogged();
  });

  it('Settings and Shelf and lending with nonsense stored', async () => {
    await corrupt(db);
    renderApp(db, '/settings');
    expect(await screen.findByTestId(Testids.settings.root)).toBeOnTheScreen();
    noBoundary();
    renderApp(db, '/settings/preferences', { 'settings/preferences': PreferencesScreen });
    expect(await screen.findByTestId(Testids.themeSetting.root)).toBeOnTheScreen();
    noBoundary();
    expectNothingLogged();
  });
});
