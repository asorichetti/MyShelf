import { useEffect } from 'react';

import type { TipBox } from './tipBox';

/** Scrolls `el`'s scrolling ancestors just enough that it sits `gap` above the tip, when the tip covers it. */
export function scrollClearOf(el: Element, box: TipBox, gap: number): void {
  const r = el.getBoundingClientRect();
  const under = r.width > 0 && r.bottom > box.y - gap && r.top < box.y + box.height && r.right > box.x && r.left < box.x + box.width;
  if (!under) return;
  let delta = r.bottom - (box.y - gap);
  for (let p = el.parentElement; p && delta > 0; p = p.parentElement) {
    if (!['auto', 'scroll'].includes(getComputedStyle(p).overflowY) || p.scrollHeight <= p.clientHeight) continue;
    const before = p.scrollTop;
    p.scrollTop = before + delta;
    delta -= p.scrollTop - before;
  }
}

/**
 * Web: while the tip floats at `box`, a control that takes keyboard focus
 * under it is scrolled up clear of it, and so is the one that had focus when
 * the tip appeared. The screen's scroller has room for this below its
 * content (`useFloatClearance`). Focus itself never moves.
 */
export function useKeepFocusClear(box: TipBox | null, host: { current: unknown }, gap: number): void {
  const key = box ? `${box.x},${box.y},${box.width},${box.height}` : '';
  useEffect(() => {
    if (!box) return;
    const inTip = (el: Element) => (host.current as Element | null)?.contains?.(el) ?? false;
    const clear = (el: Element | null) => {
      if (el && el !== document.body && !inTip(el)) scrollClearOf(el, box, gap);
    };
    clear(document.activeElement);
    const onFocus = (e: FocusEvent) => clear(e.target as Element | null);
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
    // The box is compared by value (`key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, gap, host]);
}
