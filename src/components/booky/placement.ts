import type { ObstacleRect } from '@/components/ui/layers';

/**
 * Where Booky's bubble goes (P07-07). Pure, so the edge cases are tested
 * without a screen. Booky docks at the bottom, above the tab bar, and never
 * covers anything registered as an obstacle (the Add book button, the
 * selection bar, the snackbar) or the keyboard:
 *
 * 1. Docked, centred, at most `maxWidth` wide, when that is clear.
 * 2. Otherwise stepped aside (left of a button on the right, or right of one
 *    on the left) when that leaves at least `minWidth`.
 * 3. Otherwise lifted above whatever is in the way.
 * 4. Hidden (it waits) when there is no room left below the top inset.
 */

export interface PlacementInput {
  window: { width: number; height: number };
  /** Distance from the bottom of the window to Booky's dock (above the tab bar and the safe area). */
  dock: number;
  /** Side margin, and the gap kept from obstacles. */
  margin: number;
  maxWidth: number;
  /** The narrowest the bubble may get when stepping aside. */
  minWidth: number;
  /** The bubble's measured height (0 before its first layout). */
  bubbleHeight: number;
  topInset: number;
  obstacles: readonly ObstacleRect[];
  keyboardHeight?: number;
}

export interface Placement {
  visible: boolean;
  /** Distance from the bottom of the window. */
  bottom: number;
  left: number;
  width: number;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const boxOf = (o: ObstacleRect): Box => ({ left: o.x, right: o.x + o.width, top: o.y, bottom: o.y + o.height });

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function placement(input: PlacementInput): Placement {
  const { window: win, dock, margin, maxWidth, minWidth, bubbleHeight, topInset } = input;
  const keyboard = input.keyboardHeight ?? 0;
  const obstacles = [...input.obstacles.map(boxOf), ...(keyboard > 0 ? [{ left: 0, right: win.width, top: win.height - keyboard, bottom: win.height }] : [])];
  const width = Math.max(0, Math.min(win.width - 2 * margin, maxWidth));
  const left = (win.width - width) / 2;
  // A bubble not yet measured still needs some height to test against.
  const height = Math.max(bubbleHeight, 1);
  const boxAt = (bottom: number, l = left, w = width): Box => ({ left: l, right: l + w, top: win.height - bottom - height, bottom: win.height - bottom });
  const hits = (box: Box) => obstacles.filter((o) => overlaps(box, o));
  const fits = (bottom: number) => bubbleHeight === 0 || win.height - bottom - bubbleHeight >= topInset + margin;

  const docked = boxAt(dock);
  const inTheWay = hits(docked);
  if (!inTheWay.length) return { visible: fits(dock), bottom: dock, left, width };

  // Step aside: everything in the way is on one side of the bubble's centre.
  const centre = left + width / 2;
  if (inTheWay.every((o) => o.left >= centre)) {
    const w = Math.min(...inTheWay.map((o) => o.left)) - margin - left;
    if (w >= minWidth && !hits(boxAt(dock, left, w)).length) return { visible: fits(dock), bottom: dock, left, width: w };
  }
  if (inTheWay.every((o) => o.right <= centre)) {
    const l = Math.max(...inTheWay.map((o) => o.right)) + margin;
    const w = left + width - l;
    if (w >= minWidth && !hits(boxAt(dock, l, w)).length) return { visible: fits(dock), bottom: dock, left: l, width: w };
  }

  // Lift above what is in the way, again and again for stacked obstacles.
  let bottom = dock;
  for (let blocking = inTheWay; blocking.length; blocking = hits(boxAt(bottom))) {
    bottom = Math.max(...blocking.map((o) => win.height - o.top)) + margin;
  }
  return { visible: fits(bottom), bottom, left, width };
}
