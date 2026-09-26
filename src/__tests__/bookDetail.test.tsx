import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, type Db } from '@/db';
import { setToday } from '@/domain';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  setToday('2026-06-15');
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

const routes = { 'book/[id]': BookDetailScreen, 'book/[id]/edit': stubScreen('edit') };

async function idOf(isbn: string) {
  return (await booksRepo.findBooksByIsbn(db, isbn))[0].id;
}

async function openBook(id: number | string) {
  const r = renderApp(db, `/book/${id}`, routes);
  await advance(0);
  return r;
}

/** Every string rendered on screen. */
function allText(): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'children' in node) walk((node as { children: unknown }).children);
  };
  walk(screen.toJSON());
  return out.join(' | ');
}

describe('Book detail', () => {
  it('shows every field of Dune from the demo fixture', async () => {
    await openBook(await idOf('9780441172719'));
    expect(screen.getByTestId(Testids.bookDetail.title)).toHaveTextContent('Dune');
    expect(screen.getByTestId(Testids.bookDetail.authors)).toHaveTextContent('Frank Herbert');
    expect(screen.getByTestId(Testids.bookDetail.callNumber)).toHaveTextContent('FIC HER 1965');
    const facts = screen.getByTestId(Testids.bookDetail.facts);
    for (const text of ['Ace', '1965', '40th anniversary edition', 'Paperback', '896', 'English', '9780441172719', '0441172717']) {
      expect(facts).toHaveTextContent(new RegExp(text));
    }
    expect(screen.getByTestId(Testids.bookDetail.summary)).toHaveTextContent(/Arrakis/);
    expect(screen.getByTestId(Testids.bookDetail.genres)).toHaveTextContent(/Science Fiction$/);
    expect(screen.getByTestId(Testids.bookDetail.notes)).toHaveTextContent('Signed bookplate inside the front cover.');
    expect(screen.getByTestId(Testids.bookDetail.loan)).toHaveTextContent(/Lent to Sam on 5 Jun 2026\. Due back on 26 Jun 2026\./);
    expect(screen.getByText('Due 26 Jun')).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.bookDetail.series)).toBeNull();
  });

  it('shows the series and the overdue stamp where they apply', async () => {
    await openBook(await idOf('9780552131063'));
    expect(screen.getByTestId(Testids.bookDetail.series)).toHaveTextContent(/Discworld.*Book 4.*3 of 4 owned, 1 missing/);
    expect(screen.getByTestId(Testids.bookDetail.loan)).toHaveTextContent(/not lent to anyone/);
    screen.unmount();
    await openBook(await idOf('9780007527526'));
    expect(screen.getByText('Overdue')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.bookDetail.loan)).toHaveTextContent(/5 days ago/);
  });

  it('hides empty fields instead of printing undefined', async () => {
    const book = await booksRepo.createBook(db, { title: 'Just a Title' });
    await openBook(book.id);
    expect(screen.getByTestId(Testids.bookDetail.title)).toHaveTextContent('Just a Title');
    for (const id of [Testids.bookDetail.summary, Testids.bookDetail.genres, Testids.bookDetail.series, Testids.bookDetail.notes, Testids.bookDetail.facts]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(allText()).not.toMatch(/undefined|null|NaN/);
    expect(screen.getByTestId(Testids.bookDetail.callNumber)).toHaveTextContent('GEN JUS');
  });

  it('uses real headings: one h1 (the title) and h2 sections', async () => {
    await openBook(await idOf('9780441172719'));
    const headings = screen.getAllByRole('heading');
    expect(headings.filter((h) => h.props['aria-level'] === 1).map((h) => h.props.children)).toEqual(['Dune']);
    expect(headings.filter((h) => h.props['aria-level'] === 2).map((h) => h.props.children)).toEqual(['Summary', 'Genres', 'Notes', 'Loan']);
  });

  it('collapses a long summary to five lines with Read more', async () => {
    await openBook(await idOf('9780441172719'));
    expect(screen.getByTestId(Testids.bookDetail.summary).props.numberOfLines).toBe(5);
    await act(async () => fireEvent.press(screen.getByTestId(Testids.bookDetail.readMore)));
    expect(screen.getByTestId(Testids.bookDetail.summary).props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId(Testids.bookDetail.readMore)).toHaveTextContent('Show less');
  });

  it('keeps a short summary open with no Read more', async () => {
    await openBook(await idOf('9780552131063'));
    expect(screen.getByTestId(Testids.bookDetail.summary).props.numberOfLines).toBeUndefined();
    expect(screen.queryByTestId(Testids.bookDetail.readMore)).toBeNull();
  });

  it('opens the edit form', async () => {
    const id = await idOf('9780441172719');
    const r = await openBook(id);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Edit Dune' })));
    expect(r.getPathname()).toBe(`/book/${id}/edit`);
  });

  it.each(['99999', 'abc'])('shows the error state with Booky for an unknown id (%s)', async (id) => {
    const r = await openBook(id);
    expect(screen.getByTestId(Testids.pageState.error)).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.bookMissing.title)).toHaveTextContent('Book not found');
    expect(screen.getByLabelText('Booky the bookmark, looking concerned')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.bookMissing.back)));
    expect(r.getPathname()).toBe('/');
  });
});
