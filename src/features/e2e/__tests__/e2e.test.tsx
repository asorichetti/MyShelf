import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { booksRepo, StaticDatabaseProvider, type Db } from '@/db';
import { setToday, today } from '@/domain';
import { safeNextPath } from '@/features/e2e/e2eFlag';
import { E2eScreen } from '@/features/e2e/E2eScreen';
import { NotFoundScreen } from '@/features/navigation/NotFoundScreen';
import { createTestDb } from '@/testing/createTestDb';
import { AppTestProviders } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

let db: Db;
const original = process.env.EXPO_PUBLIC_E2E;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  process.env.EXPO_PUBLIC_E2E = original;
  setToday(null);
  await db.close();
});

function Root({ children }: { children: React.ReactNode }) {
  return (
    <AppTestProviders>
      <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>
    </AppTestProviders>
  );
}

const routes = {
  index: () => <Text testID="landed">home</Text>,
  'book/[id]': () => <Text testID="landed">book</Text>,
  'e2e/index': E2eScreen,
  '+not-found': NotFoundScreen,
};

describe('/e2e fixture loader', () => {
  it('is inert without EXPO_PUBLIC_E2E: shows not-found and touches nothing', async () => {
    delete process.env.EXPO_PUBLIC_E2E;
    await booksRepo.createBook(db, { title: 'Keep me' });
    const r = renderRouter(routes, { initialUrl: '/e2e?fixture=empty&next=/', wrapper: Root });
    expect(screen.getByTestId(Testids.notFound.title)).toHaveTextContent('Page not found');
    expect(r.getPathname()).toBe('/e2e');
    expect(await booksRepo.countBooks(db)).toBe(1);
  });

  it('ignores any value other than "1"', () => {
    process.env.EXPO_PUBLIC_E2E = 'true';
    renderRouter(routes, { initialUrl: '/e2e?fixture=demo', wrapper: Root });
    expect(screen.getByTestId(Testids.notFound.root)).toBeOnTheScreen();
  });

  it('with the flag, loads the fixture and redirects to next', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    await booksRepo.createBook(db, { title: 'Replaced' });
    const r = renderRouter(routes, { initialUrl: '/e2e?fixture=demo&next=/book/3', wrapper: Root });
    expect(screen.getByTestId(Testids.pageState.loading)).toBeOnTheScreen();
    await waitFor(() => expect(r.getPathname()).toBe('/book/3'));
    expect(await booksRepo.countBooks(db)).toBe(12);
    expect((await booksRepo.listBooks(db)).some((b) => b.title === 'Replaced')).toBe(false);
  });

  it('freezes today for the session when asked', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const r = renderRouter(routes, { initialUrl: '/e2e?fixture=empty&today=2026-02-03', wrapper: Root });
    await waitFor(() => expect(r.getPathname()).toBe('/'));
    expect(today()).toBe('2026-02-03');
  });

  it('shows an error state for an unknown fixture and loads nothing', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    await booksRepo.createBook(db, { title: 'Keep me' });
    renderRouter(routes, { initialUrl: '/e2e?fixture=nope', wrapper: Root });
    expect(screen.getByTestId(Testids.pageState.error)).toBeOnTheScreen();
    expect(screen.getByText(/Unknown fixture "nope"/)).toBeOnTheScreen();
    expect(await booksRepo.countBooks(db)).toBe(1);
  });

  it('on web the loader is on unless a build opts out with EXPO_PUBLIC_E2E=0', () => {
    // The web build is a test target only (ADR 0002 and 0015).
    const web = jest.requireActual<typeof import('@/features/e2e/e2eFlag.web')>('@/features/e2e/e2eFlag.web');
    delete process.env.EXPO_PUBLIC_E2E;
    expect(web.isE2eEnabled()).toBe(true);
    process.env.EXPO_PUBLIC_E2E = '0';
    expect(web.isE2eEnabled()).toBe(false);
  });

  it('only redirects inside the app', () => {
    expect(safeNextPath('/book/1')).toBe('/book/1');
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('https://example.com')).toBe('/');
    expect(safeNextPath('//example.com')).toBe('/');
  });
});
