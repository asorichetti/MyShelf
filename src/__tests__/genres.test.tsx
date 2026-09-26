import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { genresRepo, type Db } from '@/db';
import { GenreDetailScreen } from '@/features/genres/GenreDetailScreen';
import { GenresScreen } from '@/features/genres/GenresScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const routes = { 'genres/index': GenresScreen, 'genres/[id]': GenreDetailScreen, 'book/[id]': stubScreen('book') };
const rows = () => screen.getAllByTestId(Testids.genres.row).map((r) => r.props.accessibilityLabel as string);

async function openGenres() {
  const r = renderApp(db, '/genres', routes);
  await waitFor(() => expect(screen.getAllByTestId(Testids.genres.row)).toHaveLength(4));
  return r;
}

describe('Genres screen', () => {
  it('lists genres with counts under one h1', async () => {
    await openGenres();
    expect(rows()).toEqual(['Classics, 2 books', 'Fantasy, 6 books', 'Mystery, 3 books', 'Science Fiction, 2 books']);
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1).map((h) => h.props.children)).toEqual(['Genres']);
  });

  it('renames a genre', async () => {
    await openGenres();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Rename Science Fiction' })));
    fireEvent.changeText(screen.getByTestId(Testids.genres.renameInput), 'SF');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.genres.renameSave)));
    await waitFor(() => expect(rows()).toContain('SF, 2 books'));
  });

  it('offers to merge when renaming to a name that exists, then merges', async () => {
    await openGenres();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Rename Classics' })));
    fireEvent.changeText(screen.getByTestId(Testids.genres.renameInput), 'mystery');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.genres.renameSave)));
    expect(await screen.findByText('Merge into “Mystery”?')).toBeOnTheScreen();
    expect(screen.getByText(/There’s already a genre called “Mystery”/)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.dialog.confirm)));
    await waitFor(() => expect(rows()).toEqual(['Fantasy, 6 books', 'Mystery, 4 books', 'Science Fiction, 2 books']));
  });

  it('merges through "Merge into…"', async () => {
    await openGenres();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Merge Science Fiction into another genre' })));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Fantasy, 6 books' })));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.dialog.confirm)));
    await waitFor(() => expect(rows()).toEqual(['Classics, 2 books', 'Fantasy, 8 books', 'Mystery, 3 books']));
  });

  it('deletes a genre after confirming, keeping the books', async () => {
    await openGenres();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Delete Classics' })));
    expect(screen.getByText(/stay on your shelf/)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.dialog.confirm)));
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(await genresRepo.findGenreByName(db, 'Classics')).toBeNull();
  });

  it('opens a genre to list its books', async () => {
    const r = await openGenres();
    await act(async () => fireEvent.press(screen.getAllByTestId(Testids.genres.row)[2]));
    await waitFor(() => expect(r.getPathname()).toMatch(/^\/genres\/\d+$/));
    expect(await screen.findByTestId(Testids.genres.detailTitle)).toHaveTextContent('Mystery');
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(3));
  });
});
