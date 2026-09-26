import type { typography } from './tokens';

type Typography = typeof typography;
export type PlatformTypography = { [K in keyof Typography]: Omit<Typography[K], 'fontWeight'> & { fontWeight?: Typography[K]['fontWeight'] } };

/**
 * Native: each weight is its own font file (e.g. Lora_700Bold), so fontWeight
 * is left unset; on Android a fontWeight on a custom family can select a
 * synthesised bold on top of the already-bold face.
 */
export function platformTypography(t: Typography): PlatformTypography {
  const out = {} as Record<string, unknown>;
  for (const [key, { fontWeight: _weight, ...rest }] of Object.entries(t)) out[key] = rest;
  return out as PlatformTypography;
}
