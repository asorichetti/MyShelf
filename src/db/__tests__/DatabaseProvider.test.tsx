import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { apiCacheRepo, DatabaseProvider, getSchemaVersion, LATEST_VERSION, migrate, MigrationError, useDatabase, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';
import { DatabaseErrorScreen } from '@/features/navigation/DatabaseErrorScreen';
import { AppTestProviders } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

function UsesDb() {
  const db = useDatabase();
  return <Text testID="has-db">{db ? 'ready' : 'none'}</Text>;
}

describe('DatabaseProvider', () => {
  let opened: Db[] = [];
  afterEach(async () => {
    await Promise.all(opened.map((d) => d.close()));
    opened = [];
  });
  const open = async () => {
    const db = await openNodeDatabase();
    opened.push(db);
    return db;
  };

  it('opens and migrates the database before rendering children', async () => {
    const states: string[] = [];
    render(
      <DatabaseProvider open={open} fallback={<Text>loading</Text>} onStatusChange={(s) => states.push(s)}>
        <UsesDb />
      </DatabaseProvider>,
    );
    expect(screen.getByText('loading')).toBeOnTheScreen();
    expect(await screen.findByTestId('has-db')).toHaveTextContent('ready');
    expect(await getSchemaVersion(opened[0])).toBe(LATEST_VERSION);
    expect(states).toEqual(['loading', 'ready']);
  });

  it('prunes expired API cache entries on start-up', async () => {
    const db = await openNodeDatabase();
    opened.push(db);
    await migrate(db);
    await apiCacheRepo.putEntry(db, 'https://openlibrary.org/old.json', '{}', '2000-01-01T00:00:00.000Z');
    await apiCacheRepo.putEntry(db, 'https://openlibrary.org/new.json', '{}');
    render(
      <DatabaseProvider open={async () => db}>
        <UsesDb />
      </DatabaseProvider>,
    );
    expect(await screen.findByTestId('has-db')).toHaveTextContent('ready');
    await waitFor(async () => expect(await apiCacheRepo.getEntry(db, 'https://openlibrary.org/old.json')).toBeNull());
    expect(await apiCacheRepo.getEntry(db, 'https://openlibrary.org/new.json')).not.toBeNull();
  });

  it('renders the error view when opening fails, and can retry', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    const flaky = () => (fail ? Promise.reject(new Error('disk full')) : open());
    render(
      <DatabaseProvider
        open={flaky}
        renderError={(e, retry) => (
          <Pressable role="button" accessibilityLabel="retry" onPress={retry}>
            <Text>{e.message}</Text>
          </Pressable>
        )}
      >
        <UsesDb />
      </DatabaseProvider>,
    );
    expect(await screen.findByText('disk full')).toBeOnTheScreen();
    fail = false;
    fireEvent.press(screen.getByRole('button', { name: 'retry' }));
    expect(await screen.findByTestId('has-db')).toBeOnTheScreen();
    spy.mockRestore();
  });

  it('a migration failure (a database from a newer app) shows the recovery screen, and Try again reopens (P09-04)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const newer = await openNodeDatabase();
    opened.push(newer);
    await migrate(newer);
    await newer.run("INSERT INTO schema_migrations (version, name) VALUES (999, '0999_from_the_future')");
    let db = newer;
    render(
      <AppTestProviders>
        <DatabaseProvider open={async () => db} renderError={(error, retry) => <DatabaseErrorScreen error={error} onRetry={retry} />}>
          <UsesDb />
        </DatabaseProvider>
      </AppTestProviders>,
    );
    expect(await screen.findByTestId(Testids.dbError.root)).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.pageState.error)).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.dbError.title)).toHaveTextContent("I couldn't open your library");
    expect(screen.getByText(/newer than this app understands/)).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledWith('Could not open the MyShelf database', expect.any(MigrationError));

    db = await open();
    fireEvent.press(screen.getByTestId(Testids.dbError.retry));
    expect(await screen.findByTestId('has-db')).toHaveTextContent('ready');
    expect(screen.queryByTestId(Testids.dbError.root)).toBeNull();
    spy.mockRestore();
  });

  it('a failure after unmounting changes nothing', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let reject: (e: Error) => void = () => {};
    const view = render(
      <DatabaseProvider open={() => new Promise<Db>((_, r) => (reject = r))} renderError={() => <Text>failed</Text>}>
        <UsesDb />
      </DatabaseProvider>,
    );
    view.unmount();
    reject(new Error('too late'));
    await new Promise((r) => setTimeout(r, 0));
    // The failure is logged, and no state is set on the unmounted provider (React would warn).
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['Could not open the MyShelf database']);
    spy.mockRestore();
  });

  it('useDatabase throws outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<UsesDb />)).toThrow(/DatabaseProvider/);
    spy.mockRestore();
  });
});
