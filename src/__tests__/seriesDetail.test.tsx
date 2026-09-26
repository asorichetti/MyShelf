import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, seriesRepo, type Db } from '@/db';
import { SeriesDetailScreen } from '@/features/series/SeriesDetailScreen';
import { SeriesListScreen } from '@/features/series/SeriesListScreen';
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

const routes = { series: SeriesListScreen, 'series/[id]': SeriesDetailScreen, 'book/[id]': stubScreen('book'), 'book/new': stubScreen('new') };
const hidden = { includeHiddenElements: true };
const seriesId = async (name: string) => (await seriesRepo.findSeriesByName(db, name))!.id;

async function open(name: string) {
  const r = renderApp(db, `/series/${await seriesId(name)}`, routes);
  await advance(0);
  return r;
}

async function press(el: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => fireEvent.press(el));
  await advance(20);
}

async function menu(testID: string) {
  await press(screen.getByTestId(Testids.seriesDetail.more));
  await press(screen.getByTestId(testID));
}

describe('Series detail', () => {
  it('shows Discworld on a shelf in order, with the gap in place', async () => {
    await open('Discworld');
    expect(screen.getByTestId(Testids.seriesDetail.title)).toHaveTextContent('Discworld');
    expect(screen.getByTestId(Testids.seriesDetail.progress)).toHaveTextContent('3 of 4 owned, 1 missing');
    expect(screen.getByRole('progressbar')).toHaveProp('aria-valuenow', 3);
    // The shelf: spines #1, #2, gap #3, #4.
    const shelf = screen.getByTestId(Testids.seriesDetail.shelf, hidden);
    expect(shelf.props['aria-hidden']).toBe(true);
    expect(screen.getAllByTestId(Testids.seriesDetail.spine, hidden)).toHaveLength(3);
    expect(screen.getAllByTestId(Testids.seriesDetail.gap, hidden)).toHaveLength(1);
    // The list: the same order, readable.
    expect(screen.getAllByTestId(Testids.seriesDetail.book).map((b) => b.props.accessibilityLabel)).toEqual([
      'Number 1, The Colour of Magic, 1983',
      'Number 2, The Light Fantastic, 1986',
      'Number 4, Mort, 1987',
    ]);
    expect(screen.getByText('#3 missing')).toBeOnTheScreen();
    const h1 = screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1);
    expect(h1).toHaveLength(1);
  });

  it('adds the missing book with the series filled in', async () => {
    const r = await open('Discworld');
    await press(screen.getByTestId(Testids.seriesDetail.addGap));
    expect(r.getPathname()).toBe('/book/new');
    expect(r.getSearchParams()).toMatchObject({ series: 'Discworld', position: '3' });
  });

  it('opens a book from the list', async () => {
    const r = await open('Earthsea');
    await press(screen.getAllByTestId(Testids.seriesDetail.book)[0]);
    expect(r.getPathname()).toMatch(/^\/book\/\d+$/);
  });

  it('sets how many books the series has, and shows the new gaps', async () => {
    await open('Earthsea');
    fireEvent.changeText(screen.getByTestId(Testids.seriesDetail.totalCount), '6');
    await press(screen.getByTestId(Testids.seriesDetail.totalSave));
    expect((await seriesRepo.getSeries(db, await seriesId('Earthsea')))!.totalCount).toBe(6);
    expect(screen.getByTestId(Testids.seriesDetail.progress)).toHaveTextContent('2 of 6 owned, 4 missing');
    expect(screen.getAllByTestId(Testids.seriesDetail.addGap)).toHaveLength(4);
  });

  it('will not set a total below the highest number owned', async () => {
    await open('Discworld');
    fireEvent.changeText(screen.getByTestId(Testids.seriesDetail.totalCount), '2');
    await press(screen.getByTestId(Testids.seriesDetail.totalSave));
    expect(screen.getByText('You already have #4, so it has at least 4.')).toBeOnTheScreen();
    expect((await seriesRepo.getSeries(db, await seriesId('Discworld')))!.totalCount).toBeNull();
  });

  it('renames the series everywhere', async () => {
    await open('Earthsea');
    await menu(Testids.seriesDetail.rename);
    fireEvent.changeText(screen.getByTestId(Testids.seriesDetail.renameInput), 'The Earthsea Cycle');
    await press(screen.getByTestId(Testids.dialog.confirm));
    expect(screen.getByTestId(Testids.seriesDetail.title)).toHaveTextContent('The Earthsea Cycle');
    const [wizard] = await booksRepo.searchBooks(db, 'A Wizard of Earthsea');
    expect((await booksRepo.getBookDetail(db, wizard.id))!.series?.name).toBe('The Earthsea Cycle');
  });

  it('merges a duplicate into another series after picking and confirming', async () => {
    const dup = await seriesRepo.createSeries(db, 'Disc World');
    await booksRepo.createBook(db, { title: 'Wyrd Sisters', seriesId: dup.id, seriesPosition: 6 });
    const disc = await seriesId('Discworld');
    const r = renderApp(db, `/series/${dup.id}`, routes);
    await advance(0);
    await menu(Testids.seriesDetail.merge);
    const option = screen.getAllByTestId(Testids.seriesDetail.mergeOption).find((o) => o.props.accessibilityLabel.startsWith('Discworld'))!;
    await press(option);
    expect(screen.getByTestId(Testids.dialog.root)).toHaveTextContent(/Move 1 book into Discworld, keeping their numbers, and remove “Disc World”\?/);
    await press(screen.getByTestId(Testids.dialog.confirm));
    expect(r.getPathname()).toBe(`/series/${disc}`);
    expect(await seriesRepo.getSeries(db, dup.id)).toBeNull();
    expect((await seriesRepo.listBooksInSeries(db, disc)).map((b) => b.title)).toContain('Wyrd Sisters');
  });

  it('deletes the series but keeps its books', async () => {
    const id = await seriesId('Earthsea');
    const r = await open('Earthsea');
    await menu(Testids.seriesDetail.delete);
    expect(screen.getByTestId(Testids.dialog.root)).toHaveTextContent(/The 2 books stay on your shelf/);
    await press(screen.getByTestId(Testids.dialog.confirm));
    expect(r.getPathname()).toBe('/series');
    expect(await seriesRepo.getSeries(db, id)).toBeNull();
    expect((await booksRepo.searchBooks(db, 'Earthsea')).length).toBeGreaterThan(0);
  });

  it('says so for a series that does not exist', async () => {
    renderApp(db, '/series/999', routes);
    await advance(0);
    expect(screen.getByText('Series not found')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.pageState.error)).toBeOnTheScreen();
  });
});
