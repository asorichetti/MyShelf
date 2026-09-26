import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, seriesRepo, type Db } from '@/db';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { AddBookScreen, EditBookScreen } from '@/features/book/BookFormScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const routes = { 'book/new': AddBookScreen, 'book/[id]': BookDetailScreen, 'book/[id]/edit': EditBookScreen, 'series/[id]': stubScreen('series') };

async function press(testID: string, index = 0) {
  await act(async () => fireEvent.press(screen.getAllByTestId(testID)[index]));
  await advance(0);
}

describe('The series picker in the book form', () => {
  it('puts a book in an existing series at a roman-numeral position', async () => {
    const [omens] = await booksRepo.findBooksByIsbn(db, '9780575048003');
    renderApp(db, `/book/${omens.id}/edit`, routes);
    await advance(0);
    fireEvent.changeText(screen.getByTestId(Testids.seriesInput.search), 'disc');
    await advance(0);
    await press(Testids.seriesInput.option);
    fireEvent.changeText(screen.getByTestId(Testids.seriesInput.position), 'III');
    await press(Testids.bookForm.save);

    const saved = (await booksRepo.getBook(db, omens.id))!;
    const disc = (await seriesRepo.findSeriesByName(db, 'Discworld'))!;
    expect(saved).toMatchObject({ seriesId: disc.id, seriesPosition: 3 });
    expect(await seriesRepo.seriesGapsFor(db, disc.id)).toEqual([]);
  });

  it('starts a new book in a series from "Add #3"', async () => {
    renderApp(db, '/book/new?series=Discworld&position=3', routes);
    await advance(0);
    expect(screen.getByTestId(Testids.seriesInput.search).props.value).toBe('Discworld');
    expect(screen.getByTestId(Testids.seriesInput.position).props.value).toBe('3');
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.title), 'Equal Rites');
    await press(Testids.bookForm.save);
    const [book] = await booksRepo.searchBooks(db, 'Equal Rites');
    expect(book).toMatchObject({ seriesPosition: 3 });
  });

  it('takes a book out of its series with "Not part of a series"', async () => {
    const [mort] = await booksRepo.findBooksByIsbn(db, '9780552131063');
    renderApp(db, `/book/${mort.id}/edit`, routes);
    await advance(0);
    await press(Testids.seriesInput.clear);
    await press(Testids.bookForm.save);
    expect(await booksRepo.getBook(db, mort.id)).toMatchObject({ seriesId: null, seriesPosition: null });
  });
});
