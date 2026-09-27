import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import { AUTO_DISMISS_MS, Booky, BookyBubble, BookyOverlay, BookyProvider, BookyTouchArea, emitBooky, useBooky, type BookyStore, type BookyStoreData } from '@/components/booky';
import { AppTestProviders, renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

import { isOutside, setTipBox } from '../tipBox';

import type { BookyEvent } from '../engine';

function memoryStore(initial: Partial<BookyStoreData> = {}): BookyStore & { data: BookyStoreData } {
  const data: BookyStoreData = { mode: 'helpful', muted: [], seen: [], welcome: true, ...initial };
  return { data, load: async () => ({ ...data }), save: async (patch) => void Object.assign(data, patch) };
}

function Mode() {
  const { setMode } = useBooky();
  return <Pressable role="button" accessibilityLabel="off" onPress={() => setMode('off')} />;
}

function renderOverlay(store: BookyStore = memoryStore()) {
  function Layout() {
    return (
      <BookyTouchArea style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <Mode />
        <BookyOverlay />
      </BookyTouchArea>
    );
  }
  return renderRouter(
    { _layout: Layout, index: () => <Text>home</Text> },
    {
      initialUrl: '/',
      wrapper: ({ children }) => (
        <AppTestProviders>
          <BookyProvider store={store}>{children}</BookyProvider>
        </AppTestProviders>
      ),
    },
  );
}

const send = async (event: BookyEvent) => {
  await act(async () => {});
  await act(async () => emitBooky(event));
};
const added: BookyEvent = { type: 'book-added', vars: { books: '2 books' } };
const gap: BookyEvent = { type: 'series-gap', key: 3, vars: { have: 'You have #1 and #3 of Discworld', missing: '#2 is missing.', seriesId: 3 } };
const advance = (ms: number) => act(async () => void jest.advanceTimersByTime(ms));

afterEach(() => {
  setTipBox(null);
  (AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(false);
});

describe('dismissing Booky (P07-06)', () => {
  it('shows a tip without an action with no duplicate React keys', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderOverlay();
    await send(added);
    expect(screen.getByTestId(Testids.booky.bubble)).toBeOnTheScreen();
    expect(error.mock.calls.filter(([message]) => String(message).includes('same key'))).toEqual([]);
    error.mockRestore();
  });

  it('closes with the ✕', async () => {
    renderOverlay();
    await send(added);
    fireEvent.press(screen.getByRole('button', { name: "Dismiss Booky's tip" }));
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });

  it('a tip without an action goes away by itself after 8 s', async () => {
    renderOverlay();
    await send(added);
    await advance(AUTO_DISMISS_MS - 1);
    expect(screen.getByTestId(Testids.booky.bubble)).toBeOnTheScreen();
    await advance(1);
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });

  it('a tip with an action stays until the user decides', async () => {
    renderOverlay();
    await send(gap);
    await advance(AUTO_DISMISS_MS * 3);
    expect(screen.getByTestId(Testids.seriesTip.root)).toBeOnTheScreen();
  });

  it('never goes away by itself while a screen reader is on', async () => {
    (AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(true);
    renderOverlay();
    await send(added);
    await act(async () => {});
    await advance(AUTO_DISMISS_MS * 2);
    expect(screen.getByTestId(Testids.booky.bubble)).toBeOnTheScreen();
  });

  it('a tap outside the tip puts it away; a tap on it does not', async () => {
    renderOverlay();
    await send(added);
    setTipBox({ x: 10, y: 600, width: 360, height: 120 });
    const area = screen.getByTestId(Testids.booky.tipHost).parent!.parent!;
    const tap = (pageX: number, pageY: number) => fireEvent(area, 'startShouldSetResponderCapture', { nativeEvent: { pageX, pageY } });
    act(() => void tap(100, 650));
    expect(screen.getByTestId(Testids.booky.bubble)).toBeOnTheScreen();
    act(() => void tap(100, 100));
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });

  it('knows inside from outside', () => {
    const box = { x: 10, y: 10, width: 100, height: 50 };
    expect(isOutside(box, 50, 30)).toBe(false);
    expect(isOutside(box, 5, 30)).toBe(true);
    expect(isOutside(box, 50, 61)).toBe(true);
  });
});

describe('muting (P07-06)', () => {
  it('"Don’t show tips like this" mutes the tip for good', async () => {
    const store = memoryStore();
    renderOverlay(store);
    await send(gap);
    fireEvent.press(screen.getByTestId(Testids.booky.mute));
    await act(async () => {});
    expect(store.data.muted).toEqual(['series-gap']);
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
    await send({ ...gap, key: 4 });
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
  });

  it('is offered on tips, not on help or a celebration', async () => {
    renderOverlay();
    await send(added);
    expect(screen.getByRole('button', { name: 'Don’t show tips like this' })).toBeOnTheScreen();
    await send({ type: 'help-requested', screen: 'shelf' });
    expect(screen.queryByTestId(Testids.booky.mute)).toBeNull();
    fireEvent.press(screen.getByTestId(Testids.booky.dismiss));
    await send({ type: 'series-complete', key: 1, vars: { whole: 'All 3 Earthsea books', seriesId: 1 } });
    expect(screen.getByTestId(Testids.seriesCelebration.root)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.booky.mute)).toBeNull();
  });
});

describe('Booky Off (P07-06)', () => {
  it('hides the character everywhere, but keeps Booky’s words in place', async () => {
    renderOverlay();
    await act(async () => {});
    fireEvent.press(screen.getByRole('button', { name: 'off' }));
    await send(added);
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
    screen.unmount();

    function OffPage() {
      const { setMode, mode } = useBooky();
      return (
        <>
          <Pressable role="button" accessibilityLabel="off" onPress={() => setMode('off')} />
          <Text>{mode}</Text>
          <Booky testID="illustration" />
          <BookyBubble message="I couldn’t find that one." avatarTestID="avatar" />
        </>
      );
    }
    renderWithTheme(
      <BookyProvider>
        <OffPage />
      </BookyProvider>,
    );
    expect(screen.getByTestId('illustration')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'off' }));
    expect(screen.queryByTestId('illustration')).toBeNull();
    expect(screen.queryByTestId('avatar')).toBeNull();
    expect(screen.getByText('I couldn’t find that one.')).toBeOnTheScreen();
  });
});
