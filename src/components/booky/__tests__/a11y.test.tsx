import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text, View } from 'react-native';

import { Booky, BookyBubble, bookyExpressions, BookyOverlay, BookyProvider, emitBooky, expressionDescriptions } from '@/components/booky';
import { AppTestProviders, renderWithTheme, settle } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';
import { contrastRatio } from '@/theme/contrast';
import { lightColors, textPairs } from '@/theme/tokens';

import type { BookyEvent } from '../engine';

function renderOverlay() {
  function Layout() {
    return (
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <BookyOverlay />
      </View>
    );
  }
  return renderRouter(
    { _layout: Layout, index: () => <Text>home</Text> },
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
const send = (event: BookyEvent) => act(async () => emitBooky(event));
const added: BookyEvent = { type: 'book-added', vars: { books: '2 books' } };

describe('Booky accessibility (P07-09)', () => {
  it.each(bookyExpressions)('Booky (%s) is one labelled image with its artwork hidden', async (expression) => {
    renderWithTheme(<Booky expression={expression} animated={false} testID="booky" />);
    await settle();
    const booky = screen.getByTestId('booky');
    expect(booky.props.role).toBe('img');
    expect(booky.props.accessibilityLabel).toBe(`Booky the bookmark, ${expressionDescriptions[expression]}`);
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('a floating tip is announced once, politely, from a region that is always there', async () => {
    renderOverlay();
    const announcer = screen.getByTestId(Testids.booky.announcer);
    expect(announcer.props.accessibilityLiveRegion).toBe('polite');
    expect(announcer.props['aria-live']).toBe('polite');
    expect(announcer).toHaveTextContent('');
    await send({ type: 'help-requested', screen: 'booky' });
    expect(screen.getByTestId(Testids.booky.announcer)).toHaveTextContent('Hi, I’m Booky! I keep track of your books, who has borrowed them, and which series you’re part-way through.');
    // The bubble itself is not a second live region, so nothing is read twice.
    let node = screen.getByTestId(Testids.booky.bubbleText).parent;
    while (node && node.props.testID !== Testids.booky.tipHost) {
      expect(node.props.accessibilityLiveRegion ?? 'none').toBe('none');
      node = node.parent;
    }
    fireEvent.press(screen.getByTestId(Testids.booky.dismiss));
    expect(screen.getByTestId(Testids.booky.announcer)).toHaveTextContent('');
  });

  it('never moves focus: nothing in the bubble asks for it', async () => {
    renderOverlay();
    await send(added);
    const bubble = screen.getByTestId(Testids.booky.bubble);
    const autoFocused = [bubble, ...bubble.findAll(() => true)].filter((n) => n.props.autoFocus);
    expect(autoFocused).toHaveLength(0);
  });

  it('every bubble can be closed by a labelled, full-size button (keyboard reachable on web)', async () => {
    renderOverlay();
    await send(added);
    const close = screen.getByRole('button', { name: "Dismiss Booky's tip" });
    expect(close).toHaveStyle({ width: 48, height: 48 });
    expect(close.props.focusable ?? true).not.toBe(false);
    const mute = screen.getByRole('button', { name: 'Don’t show tips like this' });
    expect(mute.props.accessibilityState?.disabled ?? false).toBe(false);
  });

  it('inline bubbles keep their own polite live region', () => {
    renderWithTheme(<BookyBubble message="I couldn’t find that one." />);
    let node = screen.getByText('I couldn’t find that one.').parent;
    while (node && !node.props['aria-live']) node = node.parent;
    expect(node?.props.accessibilityLiveRegion).toBe('polite');
  });

  it('bubble text meets WCAG AA (ink and primary on the bubble’s surface)', () => {
    for (const fg of ['ink', 'primary'] as const) {
      expect(textPairs.some(([f, b]) => f === fg && b === 'surface')).toBe(true);
      expect(contrastRatio(lightColors[fg], lightColors.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
