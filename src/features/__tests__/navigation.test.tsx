import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { BookyProvider } from '@/components/booky';
import { GroupsScreen } from '@/features/groups/GroupsScreen';
import { LoansScreen } from '@/features/loans/LoansScreen';
import { NotFoundScreen } from '@/features/navigation/NotFoundScreen';
import { TabsLayout } from '@/features/navigation/TabsLayout';
import { ScanScreen } from '@/features/scan/ScanScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { ShelfScreen } from '@/features/shelf/ShelfScreen';
import { AppTestProviders } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

function Root({ children }: { children: React.ReactNode }) {
  return (
    <AppTestProviders>
      <BookyProvider>{children}</BookyProvider>
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
  it('lands on the Shelf and shows all five tabs', () => {
    const r = renderRouter(routes, { initialUrl: '/', wrapper: Root });
    expect(r.getPathname()).toBe('/');
    expect(screen.getByTestId(Testids.home.title)).toHaveTextContent('MyShelf');
    for (const id of Object.values(Testids.nav)) expect(screen.getByTestId(id)).toBeOnTheScreen();
  });

  it.each([
    [Testids.nav.tabScan, '/scan', Testids.scan.title],
    [Testids.nav.tabLoans, '/loans', Testids.loans.title],
    [Testids.nav.tabGroups, '/groups', Testids.groups.title],
    [Testids.nav.tabSettings, '/settings', Testids.settings.title],
  ])('tab %s navigates to %s', async (tabId, path, titleId) => {
    const r = renderRouter(routes, { initialUrl: '/', wrapper: Root });
    await act(async () => fireEvent.press(screen.getByTestId(tabId)));
    expect(r.getPathname()).toBe(path);
    expect(screen.getByTestId(titleId)).toBeOnTheScreen();
  });

  it('the Shelf scan action goes to the Scan tab', async () => {
    const r = renderRouter(routes, { initialUrl: '/', wrapper: Root });
    await act(async () => fireEvent.press(screen.getByTestId(Testids.home.scanAction)));
    expect(r.getPathname()).toBe('/scan');
  });

  it('unknown URLs render the not-found screen, which links home', async () => {
    const r = renderRouter(routes, { initialUrl: '/no-such-page', wrapper: Root });
    expect(screen.getByTestId(Testids.notFound.title)).toHaveTextContent('Page not found');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.notFound.homeLink)));
    expect(r.getPathname()).toBe('/');
  });
});
