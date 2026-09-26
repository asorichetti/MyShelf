import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { pendingLookupsRepo, type Db } from '@/db';
import { emit, subscribe } from '@/features/events';
import { PendingLookupsScreen } from '@/features/settings/PendingLookupsScreen';
import { createTestDb } from '@/testing/createTestDb';
import { renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

const P = Testids.pendingList;
let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await pendingLookupsRepo.enqueue(db, '9780441172719');
  await pendingLookupsRepo.enqueue(db, '9780552166591');
  await pendingLookupsRepo.markFailed(db, '9780552166591', 'not-found');
});
afterEach(() => db.close());

describe('Settings → Pending lookups', () => {
  it('lists queued ISBNs with what is happening to each', async () => {
    renderApp(db, '/settings/pending', { 'settings/pending': PendingLookupsScreen });
    await waitFor(() => expect(screen.getAllByTestId(P.row)).toHaveLength(2));
    expect(screen.getByText('ISBN 978-0-441-17271-9')).toBeOnTheScreen();
    expect(screen.getByText(/Waiting for the internet\./)).toBeOnTheScreen();
    expect(screen.getByText(/Gave up\. No book site knows this ISBN\./)).toBeOnTheScreen();
  });

  it('removes one, and tells the queue', async () => {
    const heard = jest.fn();
    const unsubscribe = subscribe('pending-changed', heard);
    renderApp(db, '/settings/pending', { 'settings/pending': PendingLookupsScreen });
    await waitFor(() => expect(screen.getAllByTestId(P.row)).toHaveLength(2));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Remove 978-0-441-17271-9' })));
    await waitFor(() => expect(screen.getAllByTestId(P.row)).toHaveLength(1));
    expect((await pendingLookupsRepo.list(db)).map((p) => p.isbn13)).toEqual(['9780552166591']);
    expect(heard).toHaveBeenCalled();
    unsubscribe();
  });

  it('retries one: fresh attempts, and the queue is asked to try now', async () => {
    const retry = jest.fn();
    const unsubscribe = subscribe('pending-retry', retry);
    renderApp(db, '/settings/pending', { 'settings/pending': PendingLookupsScreen });
    await waitFor(() => expect(screen.getAllByTestId(P.row)).toHaveLength(2));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Retry 978-0-552-16659-1' })));
    await waitFor(async () => expect((await pendingLookupsRepo.get(db, '9780552166591'))?.attempts).toBe(0));
    expect(retry).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('shows an empty state when nothing is waiting', async () => {
    await pendingLookupsRepo.remove(db, '9780441172719');
    await pendingLookupsRepo.remove(db, '9780552166591');
    renderApp(db, '/settings/pending', { 'settings/pending': PendingLookupsScreen });
    expect(await screen.findByTestId(P.empty)).toBeOnTheScreen();
  });

  it('the Shelf banner follows a change made here at once', async () => {
    renderApp(db, '/');
    expect(await screen.findByTestId(Testids.pending.banner)).toHaveTextContent(/1 book/);
    await act(async () => {
      await pendingLookupsRepo.remove(db, '9780441172719');
      emit('pending-changed');
    });
    await waitFor(() => expect(screen.queryByTestId(Testids.pending.banner)).toBeNull());
  });
});
