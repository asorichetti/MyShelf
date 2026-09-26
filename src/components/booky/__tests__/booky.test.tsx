import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import {
  Booky,
  BookyBubble,
  bookyExpressions,
  BookyProvider,
  BookyTipHost,
  expressionDescriptions,
  useBooky,
} from '@/components/booky';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

describe('Booky', () => {
  it.each(bookyExpressions)('renders the %s expression with an accessible label', async (expression) => {
    renderWithTheme(<Booky expression={expression} testID="booky" />);
    const booky = await screen.findByTestId('booky');
    expect(booky.props.role).toBe('img');
    expect(booky.props.accessibilityLabel).toBe(`Booky the bookmark, ${expressionDescriptions[expression]}`);
    expect(screen.getByLabelText(`Booky the bookmark, ${expressionDescriptions[expression]}`)).toBeOnTheScreen();
  });

  it('draws different artwork for each expression', () => {
    const trees = bookyExpressions.map((expression) => {
      const { toJSON, unmount } = renderWithTheme(<Booky expression={expression} animated={false} />);
      const json = JSON.stringify(toJSON());
      unmount();
      return json;
    });
    expect(new Set(trees).size).toBe(bookyExpressions.length);
  });

  it('scales height from the artwork ratio', () => {
    renderWithTheme(<Booky size={60} animated={false} testID="booky" />);
    expect(screen.getByTestId('booky')).toHaveStyle({ width: 60, height: 85 });
  });

  it('checks the reduced-motion preference', async () => {
    const isReduced = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
    isReduced.mockResolvedValueOnce(true);
    renderWithTheme(<Booky testID="booky" />);
    await act(async () => {});
    expect(isReduced).toHaveBeenCalled();
    expect(screen.getByTestId('booky')).toBeOnTheScreen();
  });
});

describe('BookyBubble', () => {
  it('shows the message, actions and a dismiss button', () => {
    const onDismiss = jest.fn();
    const onAction = jest.fn();
    renderWithTheme(
      <BookyBubble
        title="Tip"
        message="Tap Scan to add your first book."
        expression="excited"
        actions={[{ label: 'Scan now', onPress: onAction, testID: 'act' }]}
        onDismiss={onDismiss}
        testID="bubble"
        dismissTestID="dismiss"
      />,
    );
    expect(screen.getByText('Tap Scan to add your first book.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Booky the bookmark, looking excited')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Scan now' }));
    expect(onAction).toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: "Dismiss Booky's tip" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('announces its text politely to screen readers', () => {
    renderWithTheme(<BookyBubble message="Hello!" testID="bubble" />);
    let node = screen.getByText('Hello!').parent;
    while (node && !node.props.accessibilityLiveRegion) node = node.parent;
    expect(node?.props.accessibilityLiveRegion).toBe('polite');
    expect(node?.props['aria-live']).toBe('polite');
  });

  it('has no dismiss button without onDismiss', () => {
    renderWithTheme(<BookyBubble message="Hi" />);
    expect(screen.queryByRole('button', { name: "Dismiss Booky's tip" })).toBeNull();
  });
});

describe('useBooky', () => {
  function Trigger() {
    const { showTip } = useBooky();
    return (
      <Pressable
        role="button"
        accessibilityLabel="help"
        onPress={() =>
          showTip({
            message: 'Books you lend show up here.',
            expression: 'thinking',
            actions: [{ label: 'Got it', onPress: jest.fn() }],
          })
        }
      >
        <Text>help</Text>
      </Pressable>
    );
  }

  it('shows a tip in the host and dismisses it', () => {
    renderWithTheme(
      <BookyProvider>
        <Trigger />
        <BookyTipHost />
      </BookyProvider>,
    );
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'help' }));
    expect(screen.getByTestId(Testids.booky.bubbleMessage)).toHaveTextContent('Books you lend show up here.');
    expect(screen.getByTestId(Testids.booky.avatar).props.accessibilityLabel).toMatch(/thinking/);
    fireEvent.press(screen.getByTestId(Testids.booky.bubbleDismiss));
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });

  it('dismisses after an action runs', () => {
    renderWithTheme(
      <BookyProvider>
        <Trigger />
        <BookyTipHost />
      </BookyProvider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'help' }));
    fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByTestId(Testids.booky.bubble)).toBeNull();
  });

  it('throws outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderWithTheme(<Trigger />)).toThrow(/BookyProvider/);
    spy.mockRestore();
  });
});
