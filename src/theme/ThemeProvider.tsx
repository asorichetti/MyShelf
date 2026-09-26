import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { applyCssVariables } from './cssVariables';
import { themes, type ColorSchemeName, type Theme } from './themes';

const ThemeContext = createContext<Theme>(themes.light);

export interface ThemeProviderProps {
  /** Colour scheme to use. Only `light` is designed today; `dark` is a hook for later. */
  scheme?: ColorSchemeName;
  /** Override the whole theme (tests, previews). */
  theme?: Theme;
  children: ReactNode;
}

export function ThemeProvider({ scheme = 'light', theme, children }: ThemeProviderProps) {
  const value = useMemo(() => theme ?? themes[scheme], [scheme, theme]);

  // On web, mirror the tokens as CSS custom properties on :root so plain CSS
  // (and automated render checks) can see the same values the app uses.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    applyCssVariables(value, root);
    root.style.setProperty('color-scheme', value.scheme);
    document.body.style.backgroundColor = value.colors.paper;
    document.body.style.color = value.colors.ink;
  }, [value]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
