import {
  elevation,
  fontFamilies,
  lightColors,
  radii,
  spacing,
  typography,
  type ColorTokens,
} from './tokens';

export type ColorSchemeName = 'light' | 'dark';

export interface Theme {
  scheme: ColorSchemeName;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  fonts: typeof fontFamilies;
  elevation: typeof elevation;
}

export const lightTheme: Theme = {
  scheme: 'light',
  colors: lightColors,
  spacing,
  radii,
  typography,
  fonts: fontFamilies,
  elevation,
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
