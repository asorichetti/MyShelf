import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { BookyProvider } from '@/components/booky';
import { StaticDatabaseProvider, type Db } from '@/db';
import { GroupsScreen } from '@/features/groups/GroupsScreen';
import { LoansScreen } from '@/features/loans/LoansScreen';
import { NotFoundScreen } from '@/features/navigation/NotFoundScreen';
import { TabsLayout } from '@/features/navigation/TabsLayout';
import { ScanScreen } from '@/features/scan/ScanScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { ShelfScreen } from '@/features/shelf/ShelfScreen';
import { openTestDatabase } from '@/testing/db';
import { AppTestProviders } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  db = await openTestDatabase();
});
afterEach(() => db.close());

function Root({ children }: { children: React.ReactNode }) {
  return (
    <AppTestProviders>
      <StaticDatabaseProvider db={db}>
        <BookyProvider>{children}</BookyProvider>
      </StaticDatabaseProvider>
    </AppTestProviders>
  );
}

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': ShelfScreen,
  '(tabs)/scan': ScanScreen,
  '(tabs)/loans': LoansScreen,
  '(tabs)/groups': GroupsScreen,
  '(tabs)/settings': SettingsScreen,
  '+not-found': NotFoundScreen,
};

describe('tab navigation', () => {
  it('lands on the Shelf and shows all five tabs', async () => {
    const r = renderRouter(routes, { initialUrl: '/', wrapper: Root });
    await screen.findByTestId(Testids.home.bookCount);
    expect(r.getPathname()).toBe('/');
    expect(screen.getByTestId(Testids.home.title)).toHaveTextContent('MyShelf');
    for (const id of Object.values(Testids.tabs)) expect(screen.getByTestId(id)).toBeOnTheScreen();
  });

  it.each([
    [Testids.tabs.scan, '/scan', Testids.scan.title],
    [Testids.tabs.loans, '/loans', Testids.loans.title],
    [Testids.tabs.groups, '/groups', Testids.groups.title],
    [Testids.tabs.settings, '/settings', Testids.settings.title],
  ])('tab %s navigates to %s', async (tabId, path, titleId) => {
    const r = renderRouter(routes, { initialUrl: '/', wrapper: Root });
    await screen.findByTestId(Testids.home.bookCount);
    await act(async () => fireEvent.press(screen.getByTestId(tabId)));
    expect(r.getPathname()).toBe(path);
    expect(screen.getByTestId(titleId)).toBeOnTheScreen();
    // The Shelf is no longer mounted: only one screen's h1 and page marker exist at a time.
    expect(screen.queryByTestId(Testids.home.title)).toBeNull();
    expect(screen.getAllByTestId(Testids.pageState.content)).toHaveLength(1);
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1)).toHaveLength(1);
  });

  it('the Shelf scan action goes to the Scan tab', async () => {
    const r = renderRouter(routes, { initialUrl: '/', wrapper: Root });
    await screen.findByTestId(Testids.home.bookCount);
    await act(async () => fireEvent.press(screen.getByTestId(Testids.home.scanAction)));
    expect(r.getPathname()).toBe('/scan');
  });

  it('unknown URLs render the not-found screen, which links home', async () => {
    const r = renderRouter(routes, { initialUrl: '/no-such-page', wrapper: Root });
    expect(screen.getByTestId(Testids.notFound.title)).toHaveTextContent('Page not found');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.notFound.homeLink)));
    expect(r.getPathname()).toBe('/');
    await screen.findByTestId(Testids.home.bookCount);
  });
});
