import { router, Stack, useLocalSearchParams } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text, View } from 'react-native';

import { BookyOverlay, BookyProvider, emitBooky, useBookyTopic, type BookyStore, type BookyStoreData } from '@/components/booky';
import { AppTestProviders } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

import { tipWaits } from '../BookyOverlay';
import { tipById } from '../tips';
import { addTopic, resetTopics, topicOnScreen } from '../topics';

import type { BookyEvent } from '../engine';

function memoryStore(): BookyStore & { data: BookyStoreData } {
  const data: BookyStoreData = { mode: 'helpful', muted: [], seen: [], welcome: true };
  return {
    data,
    load: async () => ({ ...data, muted: [...data.muted], seen: [...data.seen] }),
    save: async (patch) => {
      Object.assign(data, patch);
    },
  };
}

const overdue = (loanId: number, bookId: number, title: string): BookyEvent => ({
  type: 'loan-overdue',
  key: loanId,
  vars: { title, borrower: 'Priya', when: '5 days ago' },
  topics: [`book:${bookId}`, 'borrower:3', 'loans'],
});

function BookPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBookyTopic(`book:${id}`);
  return <Text>{`book ${id}`}</Text>;
}

function renderApp(store: BookyStore, initialUrl: string) {
  function Layout() {
    return (
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <BookyOverlay />
      </View>
    );
  }
  return renderRouter(
    { _layout: Layout, index: () => <Text>home</Text>, 'book/[id]': BookPage },
    {
      initialUrl,
      wrapper: ({ children }) => (
        <AppTestProviders>
          <BookyProvider store={store} today={() => '2026-06-15'}>
            {children}
          </BookyProvider>
        </AppTestProviders>
      ),
    },
  );
}

const flush = () => act(async () => {});

afterEach(() => resetTopics());

describe('topics on screen', () => {
  it('counts a topic while any screen holds it', () => {
    const a = addTopic('book:1');
    const b = addTopic('book:1');
    expect(topicOnScreen(['loans', 'book:1'])).toBe(true);
    a();
    a();
    expect(topicOnScreen(['book:1'])).toBe(true);
    b();
    expect(topicOnScreen(['book:1'])).toBe(false);
    expect(topicOnScreen(undefined)).toBe(false);
  });

  it('keeps a tip about what the screen shows waiting, whatever the route', () => {
    const tip = { tip: tipById('loan-overdue'), event: overdue(1, 10, 'Roger') };
    expect(tipWaits(['book', '[id]'], tip)).toBe(false);
    const remove = addTopic('book:10');
    expect(tipWaits(['book', '[id]'], tip)).toBe(true);
    expect(tipWaits(['(tabs)'], tip)).toBe(true);
    remove();
  });
});

describe('a tip about the screen in front', () => {
  it('is not floated over that screen and is not used up: it shows on the next one', async () => {
    const store = memoryStore();
    renderApp(store, '/book/10');
    await flush();
    expect(screen.getByText('book 10')).toBeOnTheScreen();

    await act(async () => emitBooky(overdue(7, 10, 'The Murder of Roger Ackroyd')));
    await flush();
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
    expect(store.data.seen).toEqual([]);

    act(() => router.navigate('/'));
    await flush();
    await act(async () => emitBooky(overdue(7, 10, 'The Murder of Roger Ackroyd')));
    await flush();
    expect(screen.getByTestId(Testids.booky.bubbleText)).toHaveTextContent('“The Murder of Roger Ackroyd” was due back from Priya 5 days ago.');
  });

  it('gives way to the next alternative that is not on screen', async () => {
    renderApp(memoryStore(), '/book/10');
    await flush();
    await act(async () => emitBooky([overdue(7, 10, 'The Murder of Roger Ackroyd'), overdue(8, 11, 'Dune')]));
    await flush();
    expect(screen.getByTestId(Testids.booky.bubbleText)).toHaveTextContent('“Dune” was due back from Priya 5 days ago.');
  });

  it('counts only the screen in front, not one left underneath in the stack', async () => {
    renderApp(memoryStore(), '/book/10');
    await flush();
    act(() => router.push('/book/11'));
    await flush();
    expect(screen.getByText('book 11')).toBeOnTheScreen();
    await act(async () => emitBooky(overdue(7, 10, 'The Murder of Roger Ackroyd')));
    await flush();
    expect(screen.getByTestId(Testids.booky.bubbleText)).toHaveTextContent(/The Murder of Roger Ackroyd/);
  });
});
