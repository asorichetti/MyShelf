import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { apiCacheRepo, DatabaseProvider, getSchemaVersion, LATEST_VERSION, migrate, useDatabase, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';

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

  it('useDatabase throws outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<UsesDb />)).toThrow(/DatabaseProvider/);
    spy.mockRestore();
  });
});
