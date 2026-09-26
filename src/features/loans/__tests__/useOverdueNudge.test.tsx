import { router, Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text, View } from 'react-native';

import { BookyProvider, BookyTipHost } from '@/components/booky';
import { StaticDatabaseProvider, type Db } from '@/db';
import { setToday } from '@/domain';
import { useOverdueNudge } from '@/features/loans/useOverdueNudge';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { AppTestProviders } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  setToday('2026-06-15');
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

function Layout() {
  useOverdueNudge();
  return (
    <View style={{ flex: 1 }}>
      <Slot />
      <BookyTipHost />
    </View>
  );
}
const Page = (name: string) =>
  function Named() {
    return <Text>{name}</Text>;
  };

function start(url: string) {
  const r = renderRouter(
    { _layout: Layout, index: Page('shelf'), loans: Page('loans'), 'e2e/index': Page('e2e') },
    {
      initialUrl: url,
      wrapper: ({ children }) => (
        <AppTestProviders>
          <StaticDatabaseProvider db={db}>
            <BookyProvider>{children}</BookyProvider>
          </StaticDatabaseProvider>
        </AppTestProviders>
      ),
    },
  );
  return r;
}
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {});
};

describe('useOverdueNudge (P05-10)', () => {
  it('has a concerned Booky mention the overdue loan on start, with "Open loans"', async () => {
    const r = start('/');
    await settle();
    expect(screen.getByTestId(Testids.booky.bubbleText)).toHaveTextContent('“The Murder of Roger Ackroyd” was due back from Priya 5 days ago.');
    expect(screen.getByLabelText('Booky the bookmark, looking concerned')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.booky.action)));
    expect(r.getPathname()).toBe('/loans');
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });

  it('puts the nudge away when the user moves to another screen', async () => {
    start('/');
    await settle();
    expect(screen.getByTestId(Testids.booky.bubble)).toBeOnTheScreen();
    act(() => router.navigate('/loans'));
    await settle();
    expect(screen.getByText('loans')).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });

  it('does not repeat the same nudge on the next start today', async () => {
    start('/');
    await settle();
    screen.unmount();
    start('/');
    await settle();
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });

  it('stays quiet while the E2E fixture loader is on screen', async () => {
    start('/e2e');
    await settle();
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });
});
