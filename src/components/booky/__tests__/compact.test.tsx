import { fireEvent, screen, within } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { BookyBubble } from '@/components/booky';
import { renderWithTheme, settle } from '@/testing/render';

import { COMPACT_FONT_SCALE, COMPACT_WINDOW_HEIGHT, isCompact } from '../BookyOverlay';

describe('isCompact', () => {
  it('turns compact from 150 % text, or on a short window', () => {
    expect(isCompact(1, 844)).toBe(false);
    expect(isCompact(1.3, 844)).toBe(false);
    expect(isCompact(COMPACT_FONT_SCALE, 844)).toBe(true);
    expect(isCompact(2, 844)).toBe(true);
    expect(isCompact(1, COMPACT_WINDOW_HEIGHT - 1)).toBe(true);
  });
});

describe('BookyBubble compact', () => {
  const props = {
    title: 'A gentle nudge',
    message: '“Dune” was due back from Sam 3 days ago.',
    expression: 'concerned' as const,
    testID: 'bubble',
    avatarTestID: 'avatar',
    dismissTestID: 'dismiss',
  };

  it('draws a small Booky inside the bubble, beside the title, instead of a big one beside it', async () => {
    renderWithTheme(<BookyBubble {...props} compact />);
    await settle();
    const avatar = screen.getByTestId('avatar');
    expect(avatar).toHaveStyle({ width: 32 });
    expect(screen.getByLabelText('Booky the bookmark, looking concerned')).toBeOnTheScreen();
    const normal = renderWithTheme(<BookyBubble {...props} testID="normal" avatarTestID="big" />);
    expect(normal.getByTestId('big')).toHaveStyle({ width: 56 });
  });

  it('scrolls long words inside a capped bubble, with ✕ outside the scroll', () => {
    const onDismiss = jest.fn();
    renderWithTheme(<BookyBubble {...props} compact maxHeight={300} onDismiss={onDismiss} actions={[{ label: 'Open loans', onPress: () => {} }]} />);
    const scroll = screen.UNSAFE_getByType(ScrollView);
    expect(within(scroll).getByText(props.message)).toBeOnTheScreen();
    expect(within(scroll).getByText('Open loans')).toBeOnTheScreen();
    expect(within(scroll).queryByTestId('dismiss')).toBeNull();
    fireEvent.press(screen.getByTestId('dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not scroll without a cap', () => {
    renderWithTheme(<BookyBubble {...props} compact />);
    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
  });
});
