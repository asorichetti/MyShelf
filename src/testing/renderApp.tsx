import { act, renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { BookyProvider } from '@/components/booky';
import { StaticDatabaseProvider, type Db } from '@/db';
import { GroupsScreen } from '@/features/groups/GroupsScreen';
import { LoansScreen } from '@/features/loans/LoansScreen';
import { NotFoundScreen } from '@/features/navigation/NotFoundScreen';
import { TabsLayout } from '@/features/navigation/TabsLayout';
import { ScanScreen } from '@/features/scan/ScanScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { ShelfScreen } from '@/features/shelf/ShelfScreen';

import { AppTestProviders } from './render';

import type { ComponentType, ReactNode } from 'react';

/** Wraps a routed test app in the app's providers, with `db` as the database. */
export function appWrapper(db: Db) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppTestProviders>
        <StaticDatabaseProvider db={db}>
          <BookyProvider>{children}</BookyProvider>
        </StaticDatabaseProvider>
      </AppTestProviders>
    );
  };
}

/** A stand-in screen that shows which route it is, for navigation assertions. */
export const stubScreen = (name: string): ComponentType =>
  function Stub() {
    return <Text>{`stub:${name}`}</Text>;
  };

/** Renders the app's tab routes plus any extra ones, starting at `url`. */
export function renderApp(db: Db, url: string, routes: Record<string, ComponentType> = {}) {
  const result = renderRouter(
    {
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': ShelfScreen,
      '(tabs)/scan': ScanScreen,
      '(tabs)/loans': LoansScreen,
      '(tabs)/groups': GroupsScreen,
      '(tabs)/settings': SettingsScreen,
      '+not-found': NotFoundScreen,
      ...routes,
    },
    { initialUrl: url, wrapper: appWrapper(db) },
  );
  return result;
}

/**
 * renderRouter runs on Jest's fake timers: move the clock (debounces,
 * snackbar timeouts) inside act, then let pending database work settle.
 */
export async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => {});
}
