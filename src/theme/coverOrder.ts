import { parseHex } from './contrast';
import { coverPalette, type CoverColors } from './tokens';

/** A colour's hue in degrees (0 = red, 120 = green, 240 = blue), from its RGB. */
export function hueOf(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/**
 * The "Rainbow" sort (P11-02): each generated binding's place when the
 * palette is laid out round the colour wheel from red, through orange,
 * green and blue, to violet and magenta. Index `i` is the rank of
 * `palette[i]`; equal hues keep palette order. The Shelf passes the
 * current theme's ranking to its query, so the rainbow follows the colours
 * on screen in light and dark alike (the dark palette's three close purples
 * sit a step differently round the wheel).
 */
export function rainbowRanks(palette: readonly CoverColors[] = coverPalette): number[] {
  const order = palette.map((c, i) => ({ i, hue: hueOf(c.cloth) })).sort((a, b) => a.hue - b.hue || a.i - b.i);
  const ranks = new Array<number>(palette.length);
  order.forEach(({ i }, rank) => (ranks[i] = rank));
  return ranks;
}
