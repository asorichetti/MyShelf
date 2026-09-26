import { act, renderHook } from '@testing-library/react-native';

import { useFloatClearance } from '@/components/ui';
import { resetLayers, setFloatingBox } from '@/components/ui/layers';
import { lightTheme } from '@/theme';

afterEach(() => act(() => resetLayers()));

/** A scroller whose bottom edge is at `bottom` in the window. */
const scroller = (top: number, bottom: number) => ({ measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, top, 390, bottom - top) });

describe('useFloatClearance', () => {
  it('is 0 with no tip floating', () => {
    const { result } = renderHook(() => useFloatClearance());
    act(() => {
      result.current.attach(scroller(0, 780));
      result.current.onLayout();
    });
    expect(result.current.clearance).toBe(0);
  });

  it('makes room from the tip’s top down to the scroller’s bottom, plus a margin', () => {
    const { result } = renderHook(() => useFloatClearance());
    act(() => {
      result.current.attach(scroller(0, 780));
      result.current.onLayout();
    });
    act(() => setFloatingBox({ x: 12, y: 600, width: 366, height: 164 }));
    expect(result.current.clearance).toBe(780 - 600 + lightTheme.spacing.md);
    act(() => setFloatingBox(null));
    expect(result.current.clearance).toBe(0);
  });

  it('needs no room when the tip floats below the scroller (over the tab bar’s edge, say)', () => {
    const { result } = renderHook(() => useFloatClearance());
    act(() => result.current.attach(scroller(0, 500)));
    act(() => setFloatingBox({ x: 12, y: 600, width: 366, height: 164 }));
    expect(result.current.clearance).toBe(0);
  });
});
