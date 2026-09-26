import { applyCssVariables } from './cssVariables';

import type { Theme } from './themes';

/**
 * Web: mirror the tokens as --ms-* custom properties on :root (so plain CSS
 * and automated render checks see the same values the app uses), mark the
 * scheme as `data-theme` and `color-scheme`, and paint the document
 * background, text colour and font from them. Called again whenever the
 * theme changes (the system scheme or the Appearance setting).
 */
export function applyThemeToDocument(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  applyCssVariables(theme, root);
  root.style.setProperty('color-scheme', theme.scheme);
  // For plain CSS and tests: which theme is showing (the tokens above already switched).
  root.dataset.theme = theme.scheme;
  document.body.style.backgroundColor = theme.colors.paper;
  document.body.style.color = theme.colors.ink;
  document.body.style.fontFamily = `${theme.fonts.body}, system-ui, sans-serif`;
}
