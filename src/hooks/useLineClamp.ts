import { useFontScale } from '@/theme';

/**
 * A `numberOfLines` that keeps as much text visible at a large font size as
 * at 100 %: two lines of a title at 200 % text become four. Truncated text
 * must still be read out in full by an accessible label on its row. The
 * `Text` and `Heading` primitives apply it to their own `numberOfLines`;
 * use it directly only for a bare React Native `Text`. `maxScale` is the
 * variant's font size cap, if any.
 */
export function useLineClamp(lines: number, maxScale?: number): number {
  const scale = Math.min(useFontScale(), maxScale ?? Infinity);
  return Math.max(lines, Math.floor(lines * scale));
}
