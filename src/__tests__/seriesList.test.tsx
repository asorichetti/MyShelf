import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, seriesRepo, type Db } from '@/db';
import { SeriesListScreen } from '@/features/series/SeriesListScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const routes = { series: SeriesListScreen, 'series/[id]': stubScreen('series-detail') };
const labels = () => screen.getAllByTestId(Testids.seriesList.row).map((r) => r.props.accessibilityLabel);

describe('Series list', () => {
  it('lists the demo series with counts that match the fixture', async () => {
    await loadFixture(db, 'demo');
    renderApp(db, '/series', routes);
    await advance(0);
    expect(labels()).toEqual(['Discworld, 3 of 4 owned, 1 missing', 'Earthsea, 2 of 3 owned, 1 missing']);
    const h1 = screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1);
    expect(h1.map((h) => h.props.children)).toEqual(['Series']);
  });

  it('sorts by most recent addition', async () => {
    await loadFixture(db, 'demo');
    const earthsea = (await seriesRepo.findSeriesByName(db, 'Earthsea'))!;
    await booksRepo.createBook(db, { title: 'Tehanu', seriesId: earthsea.id, seriesPosition: 4 });
    await db.run("UPDATE books SET created_at = '2099-01-01T00:00:00Z' WHERE title = 'Tehanu'");
    renderApp(db, '/series', routes);
    await advance(0);
    expect(labels()[0]).toMatch(/^Discworld/);
    await act(async () => fireEvent.press(screen.getByTestId(Testids.seriesList.sortRecent)));
    await advance(0);
    expect(labels()[0]).toMatch(/^Earthsea, 3 of 4 owned, 1 missing/);
    expect(screen.getByRole('radio', { name: 'Recently added' })).toBeChecked();
  });

  it('opens a series', async () => {
    await loadFixture(db, 'demo');
    const r = renderApp(db, '/series', routes);
    await advance(0);
    await act(async () => fireEvent.press(screen.getAllByTestId(Testids.seriesList.row)[1]));
    const earthsea = (await seriesRepo.findSeriesByName(db, 'Earthsea'))!;
    expect(r.getPathname()).toBe(`/series/${earthsea.id}`);
  });

  it('shows Booky when there are no series', async () => {
    await loadFixture(db, 'empty');
    renderApp(db, '/series', routes);
    await advance(0);
    expect(screen.getByTestId(Testids.seriesList.empty)).toHaveTextContent(/No series yet/);
    expect(screen.getByLabelText('Booky the bookmark, looking sleepy')).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.seriesList.row)).toBeNull();
  });
});
