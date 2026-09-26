import { useCallback, useEffect, useRef, useState } from 'react';

import { useTheme } from '@/theme';

import { useLayers } from './layers';

type Measure = (callback: (x: number, y: number, width: number, height: number) => void) => void;

/** A View or ScrollView measures itself (wrap a FlatList or SectionList in a View to measure it). */
function measurerOf(node: object | null): Measure | null {
  const n = node as { measureInWindow?: Measure } | null;
  return n?.measureInWindow ? n.measureInWindow.bind(n) : null;
}

/**
 * Room below a scrolling screen's content for Booky's floating tip (PLAN §8:
 * the tip never covers a control the user may need). While a tip floats, the
 * scroller gets extra bottom padding from the tip's top edge down to its own
 * bottom edge, plus a margin, so every control can be scrolled clear of the
 * tip; with no tip it is 0.
 *
 * Pass `attach` as the scroller's `ref` (or a View's that has the scroller's
 * bounds, around a list) and `onLayout` as its `onLayout`; add `clearance`
 * to the content's bottom padding.
 */
export function useFloatClearance(): { attach: (node: object | null) => void; onLayout: () => void; clearance: number } {
  const { floating } = useLayers();
  const { spacing } = useTheme();
  const node = useRef<object | null>(null);
  // The scroller's bottom edge in window coordinates.
  const [bottom, setBottom] = useState<number | null>(null);
  const attach = useCallback((n: object | null) => {
    node.current = n;
  }, []);
  const onLayout = useCallback(() => {
    measurerOf(node.current)?.((_x, y, _w, height) => {
      if (Number.isFinite(y) && Number.isFinite(height) && height > 0) setBottom(y + height);
    });
  }, []);
  // A tip that appears or moves: measure again (the scroller may have moved since its last layout).
  const top = floating?.y ?? null;
  useEffect(() => {
    if (top != null) onLayout();
  }, [top, onLayout]);
  const clearance = top != null && bottom != null && bottom > top ? Math.ceil(bottom - top) + spacing.md : 0;
  return { attach, onLayout, clearance };
}
