import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Pressable, Text, View } from 'react-native';

import { BookyOverlay, BookyProvider, emitBooky, useBooky, type BookyStore, type BookyStoreData } from '@/components/booky';
import { AppTestProviders } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

import type { BookyEvent } from '../engine';

function memoryStore(initial: Partial<BookyStoreData> = {}): BookyStore & { data: BookyStoreData } {
  const data: BookyStoreData = { mode: 'helpful', muted: [], seen: [], welcome: true, ...initial };
  return {
    data,
    load: async () => ({ ...data, muted: [...data.muted], seen: [...data.seen] }),
    save: async (patch) => {
      Object.assign(data, patch);
    },
  };
}

const gap: BookyEvent = { type: 'series-gap', key: 3, vars: { have: 'You have #1 and #3 of Discworld', missing: '#2 is missing.', seriesId: 3 } };
const complete: BookyEvent = { type: 'series-complete', key: 3, vars: { whole: 'All 3 Discworld books', seriesId: 3 } };

function Controls() {
  const { setMode, resetTips, muteTip, mode } = useBooky();
  return (
    <View>
      <Text>{`mode:${mode}`}</Text>
      <Pressable role="button" accessibilityLabel="off" onPress={() => setMode('off')} />
      <Pressable role="button" accessibilityLabel="reset" onPress={resetTips} />
      <Pressable role="button" accessibilityLabel="mute" onPress={() => muteTip()} />
    </View>
  );
}

function renderBooky(store?: BookyStore, now = () => 1_000_000) {
  function Layout() {
    return (
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <Controls />
        <BookyOverlay />
      </View>
    );
  }
  return renderRouter(
    { _layout: Layout, index: () => <Text>home</Text>, 'series/[id]': () => <Text>series page</Text>, 'book/new': () => <Text>form</Text>, 'e2e/index': () => <Text>e2e</Text> },
    {
      initialUrl: '/',
      wrapper: ({ children }) => (
        <AppTestProviders>
          <BookyProvider store={store} now={now} today={() => '2026-06-15'}>
            {children}
          </BookyProvider>
        </AppTestProviders>
      ),
    },
  );
}

const send = (event: BookyEvent) => act(async () => emitBooky(event));
const settle = () => act(async () => {});

describe('BookyProvider and the overlay', () => {
  it('shows the gap tip with its own test ids and thinking Booky, and opens the series', async () => {
    const r = renderBooky(memoryStore());
    await settle();
    await send(gap);
    expect(screen.getByTestId(Testids.seriesTip.text)).toHaveTextContent('You have #1 and #3 of Discworld — #2 is missing.');
    expect(screen.getByLabelText('Booky the bookmark, thinking')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.seriesTip.open)));
    expect(r.getPathname()).toBe('/series/3');
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
  });

  it('remembers once-only tips in its store, across a restart', async () => {
    const store = memoryStore();
    renderBooky(store);
    await settle();
    await send(gap);
    expect(store.data.seen).toEqual(['series-gap:3']);
    fireEvent.press(screen.getByTestId(Testids.seriesTip.dismiss));
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
    screen.unmount();
    renderBooky(store);
    await settle();
    await send(gap);
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
  });

  it('celebrates a completed series; a gap tip does not replace it', async () => {
    renderBooky(memoryStore());
    await settle();
    await send(complete);
    expect(screen.getByTestId(Testids.seriesCelebration.text)).toHaveTextContent('Series complete! All 3 Discworld books.');
    await send({ ...gap, key: 4 });
    expect(screen.getByTestId(Testids.seriesCelebration.root)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
    fireEvent.press(screen.getByTestId(Testids.seriesCelebration.dismiss));
    expect(screen.queryByTestId(Testids.seriesCelebration.root)).toBeNull();
  });

  it('follows the mode from the store, and saves a new one', async () => {
    const store = memoryStore({ mode: 'quiet' });
    renderBooky(store);
    await settle();
    expect(screen.getByText('mode:quiet')).toBeOnTheScreen();
    await send(gap);
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'off' }));
    await settle();
    expect(store.data.mode).toBe('off');
    await send(complete);
    expect(screen.queryByTestId(Testids.seriesCelebration.root)).toBeNull();
  });

  it('mutes the tip showing, and reset brings everything back', async () => {
    const store = memoryStore();
    renderBooky(store);
    await settle();
    await send({ type: 'book-added', vars: { books: '2 books' } });
    expect(screen.getByTestId(Testids.booky.bubbleText)).toHaveTextContent('Shelved! That’s 2 books.');
    fireEvent.press(screen.getByRole('button', { name: 'mute' }));
    await settle();
    expect(store.data.muted).toEqual(['book-added']);
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
    await send({ type: 'book-added', vars: { books: '3 books' } });
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'reset' }));
    await settle();
    expect(store.data).toMatchObject({ muted: [], seen: [] });
  });

  it('keeps a tip waiting on screens with a bottom bar, and shows it after', async () => {
    renderBooky(memoryStore());
    await settle();
    act(() => router.navigate('/book/new'));
    await send({ type: 'book-added', vars: { books: '2 books' } });
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
    act(() => router.back());
    await settle();
    expect(screen.getByTestId(Testids.booky.bubble)).toBeOnTheScreen();
  });

  it('puts a screen-bound tip away when the user moves on', async () => {
    renderBooky(memoryStore());
    await settle();
    await send({ type: 'loan-overdue', key: 1, vars: { title: 'Dune', borrower: 'Sam', when: '3 days ago' } });
    expect(screen.getByTestId(Testids.booky.bubbleText)).toHaveTextContent('“Dune” was due back from Sam 3 days ago.');
    act(() => router.navigate('/series/1'));
    await settle();
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });

  it('works without a store (nothing is remembered)', async () => {
    renderBooky();
    await settle();
    await send({ type: 'help-requested', screen: 'booky' });
    expect(screen.getByTestId(Testids.booky.bubbleText)).toHaveTextContent(/I keep track of your books/);
  });

  it('throws outside a provider', () => {
    function Naked() {
      useBooky();
      return null;
    }
    expect(() => renderRouter({ index: Naked }, { initialUrl: '/' })).toThrow(/BookyProvider/);
  });
});
