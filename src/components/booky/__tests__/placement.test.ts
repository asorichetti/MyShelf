import { placement, type PlacementInput } from '../placement';

// A 390 x 844 phone with a 64 px tab bar: Booky docks 12 px above it.
const phone = (patch: Partial<PlacementInput> = {}): PlacementInput => ({
  window: { width: 390, height: 844 },
  dock: 76,
  margin: 12,
  maxWidth: 560,
  minWidth: 260,
  bubbleHeight: 120,
  topInset: 0,
  obstacles: [],
  ...patch,
});
const tablet = (patch: Partial<PlacementInput> = {}) => phone({ window: { width: 820, height: 1180 }, ...patch });

/** The bubble's box in window coordinates. */
const box = (p: ReturnType<typeof placement>, input: PlacementInput) => ({
  left: p.left,
  right: p.left + p.width,
  top: input.window.height - p.bottom - input.bubbleHeight,
  bottom: input.window.height - p.bottom,
});
const clear = (a: ReturnType<typeof box>, o: { x: number; y: number; width: number; height: number }) =>
  a.right <= o.x || o.x + o.width <= a.left || a.bottom <= o.y || o.y + o.height <= a.top;

describe('placement (P07-07)', () => {
  it('docks centred above the tab bar when nothing is in the way', () => {
    expect(placement(phone())).toEqual({ visible: true, bottom: 76, left: 12, width: 366 });
  });

  it('never gets wider than the bubble’s maximum (tablet)', () => {
    expect(placement(tablet())).toEqual({ visible: true, bottom: 76, left: 130, width: 560 });
  });

  it('lifts above the Add book button when there is no room beside it (phone)', () => {
    const fab = { x: 250, y: 700, width: 124, height: 48 };
    const input = phone({ obstacles: [fab] });
    const p = placement(input);
    expect(p).toMatchObject({ visible: true, bottom: 844 - 700 + 12, left: 12, width: 366 });
    expect(clear(box(p, input), fab)).toBe(true);
  });

  it('steps left of a button on the right when that leaves enough room (tablet)', () => {
    const fab = { x: 680, y: 1040, width: 124, height: 48 };
    const input = tablet({ obstacles: [fab] });
    const p = placement(input);
    expect(p).toMatchObject({ visible: true, bottom: 76, left: 130, width: 680 - 12 - 130 });
    expect(clear(box(p, input), fab)).toBe(true);
  });

  it('steps right of something on the left', () => {
    const thing = { x: 0, y: 1040, width: 200, height: 48 };
    const input = tablet({ obstacles: [thing] });
    const p = placement(input);
    expect(p).toMatchObject({ bottom: 76, left: 212, width: 690 - 212 });
    expect(clear(box(p, input), thing)).toBe(true);
  });

  it('lifts above a full-width selection bar, and above a snackbar stacked over it', () => {
    const bar = { x: 12, y: 660, width: 366, height: 100 };
    const snack = { x: 12, y: 590, width: 366, height: 56 };
    const input = phone({ obstacles: [bar, snack] });
    const p = placement(input);
    expect(p.bottom).toBe(844 - 590 + 12);
    expect(clear(box(p, input), bar) && clear(box(p, input), snack)).toBe(true);
  });

  it('ignores obstacles that are not in its way', () => {
    expect(placement(phone({ obstacles: [{ x: 0, y: 100, width: 390, height: 50 }] })).bottom).toBe(76);
  });

  it('lifts above the keyboard', () => {
    expect(placement(phone({ keyboardHeight: 300 }))).toMatchObject({ visible: true, bottom: 312 });
  });

  it('waits (hidden) when there is no room left below the top', () => {
    expect(placement(phone({ keyboardHeight: 720 })).visible).toBe(false);
    expect(placement(phone({ topInset: 40, obstacles: [{ x: 0, y: 150, width: 390, height: 600 }] })).visible).toBe(false);
  });

  it('shows before it has been measured', () => {
    expect(placement(phone({ bubbleHeight: 0, keyboardHeight: 700 })).visible).toBe(true);
  });

  it('handles a very narrow window', () => {
    const p = placement(phone({ window: { width: 20, height: 600 } }));
    expect(p.width).toBe(0);
    expect(p.visible).toBe(true);
  });
});
