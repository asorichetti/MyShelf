import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { applyThemeToDocument } from './cssVars';
import { themes, type ColorSchemeName, type Theme } from './themes';

/** Light, dark, or whatever the phone (or browser) is set to. */
export type ThemePreference = 'system' | ColorSchemeName;

export const themePreferences: readonly ThemePreference[] = ['system', 'light', 'dark'];

interface ThemePreferenceState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<Theme>(themes.light);
const PreferenceContext = createContext<ThemePreferenceState>({ preference: 'system', setPreference: () => {} });

export interface ThemeProviderProps {
  /** Force a colour scheme, whatever the preference and the system say (tests, previews). */
  scheme?: ColorSchemeName;
  /** Override the whole theme (tests, previews). */
  theme?: Theme;
  /** The preference to start with (default `system`); `useThemePreference().setPreference` changes it. */
  initialPreference?: ThemePreference;
  children: ReactNode;
}

/** The scheme a preference comes to, given the system's (`null` when the platform does not say). */
export function resolveScheme(preference: ThemePreference, system: string | null | undefined): ColorSchemeName {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

/**
 * Provides the theme (P09-02): the user's preference (System, Light or Dark;
 * the app stores it in settings and passes it in through
 * `useThemePreference`) resolved against the system colour scheme, which it
 * follows as it changes. On web the tokens are mirrored onto `:root`.
 */
export function ThemeProvider({ scheme, theme, initialPreference = 'system', children }: ThemeProviderProps) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);
  const resolved = scheme ?? resolveScheme(preference, system);
  const value = useMemo(() => theme ?? themes[resolved], [resolved, theme]);
  const preferenceState = useMemo(() => ({ preference, setPreference }), [preference]);

  // Web only (cssVars.web.ts): mirror tokens onto :root as --ms-* properties.
  useLayoutEffect(() => applyThemeToDocument(value), [value]);

  return (
    <PreferenceContext.Provider value={preferenceState}>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </PreferenceContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** The theme preference and its setter (the app's settings watcher keeps it in step with the stored setting). */
export function useThemePreference(): ThemePreferenceState {
  return useContext(PreferenceContext);
}
