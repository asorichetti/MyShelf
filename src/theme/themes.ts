import { platformTypography, type PlatformTypography } from './platformTypography';
import {
  coverPalette,
  coverSizes,
  elevation,
  fontFamilies,
  lightColors,
  radii,
  sizes,
  spacing,
  typography,
  type ColorTokens,
  type CoverColors,
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
  elevation: typeof elevation;
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

/**
 * Registry of available themes. A dark theme slots in here later: add
 * `darkColors` in tokens.ts, a `darkTheme` below, and set `dark: darkTheme`.
 * Until then the dark scheme falls back to light.
 */
export const themes: Record<ColorSchemeName, Theme> = {
  light: lightTheme,
  dark: lightTheme,
};
