import { act, fireEvent, screen } from 'expo-router/testing-library';

import { pendingLookupsRepo, type Db } from '@/db';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

describe('Books waiting for details (P02-10)', () => {
  it('shows the offline queue on the Shelf, and the retry stays offline without the network', async () => {
    await loadFixture(db, 'demo');
    await pendingLookupsRepo.enqueue(db, OL_BOOKS.colourOfMagic);
    await pendingLookupsRepo.enqueue(db, OL_BOOKS.theMartian);
    renderApp(db, '/');
    await advance(0);
    await advance(0);
    const banner = screen.getByTestId(Testids.pending.banner);
    expect(banner).toHaveTextContent(/2 books waiting for details/);
    await act(async () => {
      fireEvent.press(screen.getByTestId(Testids.pending.retry));
    });
    await advance(0);
    // Tests have no network: the lookups stay queued without counting an attempt.
    expect(screen.getByTestId(Testids.pending.banner)).toHaveTextContent(/2 books waiting/);
    expect((await pendingLookupsRepo.list(db)).map((p) => p.attempts)).toEqual([0, 0]);
  });

  it('shows no banner when nothing is queued', async () => {
    await loadFixture(db, 'empty');
    renderApp(db, '/');
    await advance(0);
    expect(screen.queryByTestId(Testids.pending.banner)).toBeNull();
  });
});
