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
