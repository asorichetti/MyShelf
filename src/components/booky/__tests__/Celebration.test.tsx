import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { Celebration } from '@/components/booky';
import { CONFETTI_DELAY_MS, CONFETTI_MS } from '@/components/booky/Celebration';
import { renderWithTheme } from '@/testing/render';

const isReduced = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;

async function renderCelebration(onDismiss = jest.fn()) {
  renderWithTheme(
    <Celebration
      title="Hooray!"
      message="Series complete! All 9 Discworld books."
      onDismiss={onDismiss}
      testID="celebration"
      messageTestID="message"
      dismissTestID="dismiss"
      confettiTestID="confetti"
    />,
  );
  await act(async () => {});
  return onDismiss;
}

describe('Celebration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows excited Booky with the message, announced politely', async () => {
    await renderCelebration();
    expect(screen.getByTestId('message')).toHaveTextContent('Series complete! All 9 Discworld books.');
    expect(screen.getByLabelText('Booky the bookmark, looking excited')).toBeOnTheScreen();
    expect(screen.getByText('Hooray!')).toBeOnTheScreen();
  });

  it('drops a one-time shower of bookmarks, hidden from assistive tech, then clears it', async () => {
    await renderCelebration();
    expect(screen.queryByTestId('confetti', { includeHiddenElements: true })).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(CONFETTI_DELAY_MS);
    });
    const confetti = screen.getByTestId('confetti', { includeHiddenElements: true });
    expect(confetti.props['aria-hidden']).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(CONFETTI_MS + 1000);
    });
    expect(screen.queryByTestId('confetti', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('message')).toBeOnTheScreen();
  });

  it('skips the confetti when the OS asks for reduced motion', async () => {
    const original = isReduced.getMockImplementation();
    isReduced.mockResolvedValue(true);
    await renderCelebration();
    isReduced.mockImplementation(original ?? (() => Promise.resolve(false)));
    expect(screen.queryByTestId('confetti', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('message')).toBeOnTheScreen();
  });

  it('closes with the dismiss button', async () => {
    const onDismiss = await renderCelebration();
    fireEvent.press(screen.getByTestId('dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
