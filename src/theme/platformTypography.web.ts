import type { typography } from './tokens';

type Typography = typeof typography;
export type PlatformTypography = { [K in keyof Typography]: Omit<Typography[K], 'fontWeight'> & { fontWeight?: Typography[K]['fontWeight'] } };

/**
 * Web: keep fontWeight so the computed style reports the real weight (for
 * assistive tech, reader modes and automated checks). public/index.html sets
 * `font-synthesis: none` so the browser uses the weight-specific face as-is
 * instead of faking bold on top of it.
 */
export function platformTypography(t: Typography): PlatformTypography {
  return t;
}
