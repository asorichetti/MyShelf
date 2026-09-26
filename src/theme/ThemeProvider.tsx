import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';

import { applyThemeToDocument } from './cssVars';
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

  // Web only (cssVars.web.ts): mirror tokens onto :root as --ms-* properties.
  useLayoutEffect(() => applyThemeToDocument(value), [value]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
