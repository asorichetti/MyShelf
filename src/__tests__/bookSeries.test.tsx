import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, seriesRepo, type Db } from '@/db';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const routes = { 'book/[id]': BookDetailScreen, 'book/[id]/edit': stubScreen('edit'), 'series/[id]': stubScreen('series') };

async function openBook(title: string) {
  const [book] = await booksRepo.searchBooks(db, title);
  const r = renderApp(db, `/book/${book.id}`, routes);
  await advance(0);
  return { r, book };
}

async function press(testID: string) {
  await act(async () => fireEvent.press(screen.getByTestId(testID)));
  await advance(0);
}

describe('The series on a book’s page', () => {
  beforeEach(() => loadFixture(db, 'demo'));

  it('shows the place in the series, previous and next', async () => {
    await openBook('The Light Fantastic');
    expect(screen.getByTestId(Testids.bookSeries.place)).toHaveTextContent('Book 2');
    expect(screen.getByTestId(Testids.bookSeries.previous)).toHaveTextContent(/The Colour of Magic \(#1\)/);
    expect(screen.getByTestId(Testids.bookSeries.next)).toHaveTextContent(/#3 isn’t on your shelf yet/);
  });

  it('goes to the previous book and to the series', async () => {
    const { r } = await openBook('The Light Fantastic');
    await press(Testids.bookSeries.previous);
    expect(r.getPathname()).toMatch(/^\/book\/\d+$/);
    expect(screen.getByTestId(Testids.bookDetail.title)).toHaveTextContent('The Colour of Magic');
    expect(screen.queryByTestId(Testids.bookSeries.previous)).toBeNull();
    await press(Testids.bookSeries.link);
    expect(r.getPathname()).toBe(`/series/${(await seriesRepo.findSeriesByName(db, 'Discworld'))!.id}`);
  });

  it('asks nothing about a series the user entered', async () => {
    await openBook('Mort');
    expect(screen.queryByTestId(Testids.seriesConfirm.root)).toBeNull();
  });
});

describe('Confirming a detected series', () => {
  beforeEach(() => loadFixture(db, 'series'));

  it('asks "Is this Discworld #8?" and Yes keeps it', async () => {
    const { book } = await openBook('Guards');
    expect(screen.getByTestId(Testids.seriesConfirm.root)).toHaveTextContent(/Is this Discworld #8\?/);
    await press(Testids.seriesConfirm.yes);
    expect(screen.queryByTestId(Testids.seriesConfirm.root)).toBeNull();
    expect((await booksRepo.getBook(db, book.id))!.seriesPosition).toBe(8);
  });

  it('Not a series removes the series section', async () => {
    const { book } = await openBook('Name of the Wind');
    expect(screen.getByTestId(Testids.seriesConfirm.root)).toHaveTextContent(/Is this The Kingkiller Chronicle #1\?/);
    await press(Testids.seriesConfirm.no);
    await advance(0);
    expect(screen.queryByTestId(Testids.bookDetail.series)).toBeNull();
    expect((await booksRepo.getBook(db, book.id))!.seriesId).toBeNull();
  });

  it('Change opens the series picker in place', async () => {
    const { book } = await openBook('Guards');
    await press(Testids.seriesConfirm.change);
    expect(screen.getByTestId(Testids.seriesInput.search).props.value).toBe('Discworld');
    fireEvent.changeText(screen.getByTestId(Testids.seriesInput.position), '8.5');
    await press(Testids.seriesConfirm.save);
    await advance(0);
    expect(screen.queryByTestId(Testids.seriesConfirm.root)).toBeNull();
    expect((await booksRepo.getBook(db, book.id))!.seriesPosition).toBe(8.5);
    expect(screen.getByTestId(Testids.bookSeries.place)).toHaveTextContent('Book 8.5');
  });
});
