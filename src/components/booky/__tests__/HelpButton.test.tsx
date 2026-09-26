import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Pressable, View } from 'react-native';

import { BookyOverlay, BookyProvider, HelpButton, useBooky } from '@/components/booky';
import { AppTestProviders, renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

import type { HelpScreen } from '../tips';

function ModeSwitch() {
  const { setMode } = useBooky();
  return <Pressable role="button" accessibilityLabel="turn Booky off" onPress={() => setMode('off')} />;
}

function renderHelp(screenId: HelpScreen, onMore?: () => void) {
  function Page() {
    return (
      <View>
        <HelpButton screen={screenId} onMore={onMore} />
        <ModeSwitch />
      </View>
    );
  }
  function Layout() {
    return (
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <BookyOverlay />
      </View>
    );
  }
  return renderRouter(
    { _layout: Layout, index: Page },
    {
      initialUrl: '/',
      wrapper: ({ children }) => (
        <AppTestProviders>
          <BookyProvider>{children}</BookyProvider>
        </AppTestProviders>
      ),
    },
  );
}

const press = (el: Parameters<typeof fireEvent.press>[0]) => act(async () => fireEvent.press(el));

describe('HelpButton (P07-05)', () => {
  it('is a labelled, full-size button', () => {
    renderHelp('shelf');
    const button = screen.getByRole('button', { name: 'Help with this screen' });
    expect(button).toHaveStyle({ width: 48, height: 48 });
    expect(button.props.testID).toBe(Testids.booky.helpButton);
  });

  it('has thinking Booky explain the screen, and "More help" opens the help sheet', async () => {
    renderHelp('series');
    await press(screen.getByTestId(Testids.booky.helpButton));
    expect(screen.getByTestId(Testids.booky.bubbleText)).toHaveTextContent('The whole series in order. Dashed spines are the books you don’t have yet.');
    expect(screen.getByLabelText('Booky the bookmark, thinking')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.booky.helpButton).props.accessibilityState).toMatchObject({ expanded: true });
    await press(screen.getByTestId(Testids.booky.helpMore));
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
    const sheet = screen.getByTestId(Testids.booky.helpSheet);
    expect(sheet.props.role).toBe('dialog');
    expect(sheet).toHaveTextContent(/How do series gaps work\?/);
    await press(screen.getByTestId(Testids.booky.helpClose));
    expect(screen.queryByTestId(Testids.booky.helpSheet)).toBeNull();
  });

  it('pressing it again puts the tip away', async () => {
    renderHelp('loans');
    await press(screen.getByTestId(Testids.booky.helpButton));
    expect(screen.getByTestId(Testids.booky.bubble)).toBeOnTheScreen();
    await press(screen.getByTestId(Testids.booky.helpButton));
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });

  it('uses the screen’s own "More help" when it has one', async () => {
    const onMore = jest.fn();
    renderHelp('scan', onMore);
    await press(screen.getByTestId(Testids.booky.helpButton));
    await press(screen.getByTestId(Testids.booky.helpMore));
    expect(onMore).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(Testids.booky.helpSheet)).toBeNull();
  });

  it('with Booky off, opens the help sheet straight away, without the character', async () => {
    renderHelp('groups');
    await press(screen.getByRole('button', { name: 'turn Booky off' }));
    await press(screen.getByTestId(Testids.booky.helpButton));
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
    const sheet = screen.getByTestId(Testids.booky.helpSheet);
    expect(sheet).toHaveTextContent(/What is a group\?/);
    expect(screen.queryByLabelText(/^Booky the bookmark/)).toBeNull();
  });

  it('works without Booky’s provider, through the screen’s own help', () => {
    const onMore = jest.fn();
    renderWithTheme(<HelpButton screen="scan" onMore={onMore} />);
    fireEvent.press(screen.getByRole('button', { name: 'Help with this screen' }));
    expect(onMore).toHaveBeenCalled();
  });
});
