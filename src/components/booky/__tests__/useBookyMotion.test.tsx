import { act, renderHook, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { Booky, BookyBubble } from '@/components/booky';
import { resetReducedMotionCache } from '@/hooks/useReducedMotion';
import { renderWithTheme } from '@/testing/render';

import { BLINK_EVERY_MS, BLINK_MS, useBookyMotion } from '../useBookyMotion';

const reduceMotion = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  resetReducedMotionCache();
  intervals = jest.spyOn(global, 'setInterval');
  clearSpy = jest.spyOn(global, 'clearInterval');
});
afterEach(() => {
  jest.useRealTimers();
  reduceMotion.mockResolvedValue(false);
  jest.restoreAllMocks();
});

const settle = () => act(async () => {});
/** Blink timers still pending (setInterval is only used for the blink). */
let intervals: jest.SpyInstance;
const blinkTimers = () => intervals.mock.calls.length - (clearSpy?.mock.calls.length ?? 0);
let clearSpy: jest.SpyInstance | undefined;

describe('useBookyMotion (P07-08)', () => {
  it('schedules nothing at all with reduced motion', async () => {
    reduceMotion.mockResolvedValue(true);
    const loop = jest.spyOn(Animated, 'loop');
    const { result } = renderHook(() => useBookyMotion(true));
    await settle();
    expect(loop).not.toHaveBeenCalled();
    expect(blinkTimers()).toBe(0);
    expect(result.current).toEqual({ translateY: 0, blinking: false });
  });

  it('waits for the preference before moving (unknown counts as reduce)', () => {
    reduceMotion.mockReturnValue(new Promise(() => {}));
    const loop = jest.spyOn(Animated, 'loop');
    renderHook(() => useBookyMotion(true));
    expect(loop).not.toHaveBeenCalled();
    expect(blinkTimers()).toBe(0);
  });

  it('schedules nothing when not animated', async () => {
    reduceMotion.mockResolvedValue(false);
    const loop = jest.spyOn(Animated, 'loop');
    renderHook(() => useBookyMotion(false));
    await settle();
    expect(loop).not.toHaveBeenCalled();
    expect(blinkTimers()).toBe(0);
  });

  it('bobs and blinks every ~5 s when motion is fine', async () => {
    reduceMotion.mockResolvedValue(false);
    const loop = jest.spyOn(Animated, 'loop');
    const { result } = renderHook(() => useBookyMotion(true));
    await settle();
    expect(loop).toHaveBeenCalledTimes(1);
    expect(result.current.translateY).not.toBe(0);
    expect(result.current.blinking).toBe(false);
    act(() => void jest.advanceTimersByTime(BLINK_EVERY_MS));
    expect(result.current.blinking).toBe(true);
    act(() => void jest.advanceTimersByTime(BLINK_MS));
    expect(result.current.blinking).toBe(false);
  });

  it('stops everything when reduced motion is turned on', async () => {
    reduceMotion.mockResolvedValue(false);
    let listener: ((v: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_: string, fn: (v: boolean) => void) => {
      listener = fn;
      return { remove: jest.fn() };
    }) as unknown as typeof AccessibilityInfo.addEventListener);
    const { result } = renderHook(() => useBookyMotion(true));
    await settle();
    act(() => listener?.(true));
    expect(result.current.translateY).toBe(0);
    expect(blinkTimers()).toBe(0);
  });
});

describe('Booky and the bubble', () => {
  it('Booky blinks: the artwork changes for a moment, the size never does', async () => {
    reduceMotion.mockResolvedValue(false);
    renderWithTheme(<Booky expression="happy" testID="booky" size={60} />);
    await settle();
    const open = JSON.stringify(screen.toJSON());
    act(() => void jest.advanceTimersByTime(BLINK_EVERY_MS));
    expect(JSON.stringify(screen.toJSON())).not.toBe(open);
    expect(screen.getByTestId('booky')).toHaveStyle({ width: 60, height: 85 });
    act(() => void jest.advanceTimersByTime(BLINK_MS));
    expect(JSON.stringify(screen.toJSON())).toBe(open);
  });

  it('the bubble pops in only when motion is fine', async () => {
    reduceMotion.mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const { unmount } = renderWithTheme(<BookyBubble message="Hi" pop testID="bubble" />);
    await settle();
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByTestId('bubble')).not.toHaveStyle({ opacity: 0 });
    unmount();

    reduceMotion.mockResolvedValue(false);
    renderWithTheme(<Booky animated={false} />); // learns the preference
    await settle();
    renderWithTheme(<BookyBubble message="Hello" pop testID="bubble2" />);
    await settle();
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 150 }));
  });
});
