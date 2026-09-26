import { platformTypography, type PlatformTypography } from './platformTypography';
import {
  coverPalette,
  coverSizes,
  darkColors,
  darkCoverPalette,
  darkElevation,
  elevation,
  fontFamilies,
  lightColors,
  radii,
  sizes,
  spacing,
  typography,
  type ColorTokens,
  type CoverColors,
  type TypographyVariant,
} from './tokens';

export type ColorSchemeName = 'light' | 'dark';

export interface Theme {
  scheme: ColorSchemeName;
  colors: ColorTokens;
  spacing: typeof spacing;
  sizes: typeof sizes;
  radii: typeof radii;
  typography: PlatformTypography;
  fonts: typeof fontFamilies;
  elevation: Record<keyof typeof elevation, string>;
  covers: readonly CoverColors[];
  coverSizes: typeof coverSizes;
}

export const lightTheme: Theme = {
  scheme: 'light',
  colors: lightColors,
  spacing,
  sizes,
  radii,
  typography: platformTypography(typography),
  fonts: fontFamilies,
  elevation,
  covers: coverPalette,
  coverSizes,
};

/** The night library (P09-02): the same type, spacing and shapes with dark colours, covers and shadows. */
export const darkTheme: Theme = {
  ...lightTheme,
  scheme: 'dark',
  colors: darkColors,
  elevation: darkElevation,
  covers: darkCoverPalette,
};

/** Registry of available themes, by colour scheme. */
export const themes: Record<ColorSchemeName, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};

/**
 * Most text grows with the system font size without limit, but a few
 * variants stop earlier because their boxes cannot grow with them: tab bar
 * labels share the bar's width five ways, so they stop at 150 %. Native
 * `Text` applies these as `maxFontSizeMultiplier`; the web emulation applies
 * the same caps in `scaleTypography`.
 */
export const typographyMaxScale: Partial<Record<TypographyVariant, number>> = {
  tabLabel: 1.5,
};

/**
 * The typography tokens at a font scale (web only: on a phone the system
 * scales text itself), each variant capped by `typographyMaxScale`. Sizes
 * and line heights grow together; letter spacing stays.
 */
export function scaleTypography(t: PlatformTypography, scale: number): PlatformTypography {
  if (scale === 1) return t;
  const out = {} as Record<string, unknown>;
  for (const [key, style] of Object.entries(t)) {
    const s = Math.min(scale, typographyMaxScale[key as TypographyVariant] ?? scale);
    out[key] = { ...style, fontSize: Math.round(style.fontSize * s), lineHeight: Math.round(style.lineHeight * s) };
  }
  return out as PlatformTypography;
}

/** A theme whose text is `scale` times its designed size (see `scaleTypography`). */
export function scaleTheme(theme: Theme, scale: number): Theme {
  return scale === 1 ? theme : { ...theme, typography: scaleTypography(theme.typography, scale) };
}

/**
 * Type for lettering that is part of a picture: the title on a generated
 * cover or up a spine. It keeps its designed size whatever the font size
 * setting (with `allowFontScaling={false}` on the phone), because the
 * picture does not grow; the same words are always in the adjacent text or
 * the control's accessible name, which do scale.
 */
export const artworkTypography: PlatformTypography = lightTheme.typography;
