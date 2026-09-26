/**
 * Where the floating tip is on screen (window coordinates), so a tap
 * anywhere else can put it away (`BookyTouchArea`). One tip floats at a time.
 */
export interface TipBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

let box: TipBox | null = null;

export const setTipBox = (next: TipBox | null) => {
  box = next;
};

export const getTipBox = (): TipBox | null => box;

/** Whether a tap at (x, y) lands outside the tip. */
export function isOutside(tip: TipBox, x: number, y: number): boolean {
  return x < tip.x || x > tip.x + tip.width || y < tip.y || y > tip.y + tip.height;
}
