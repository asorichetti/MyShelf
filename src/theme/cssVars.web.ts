import { applyCssVariables } from './cssVariables';
import type { Theme } from './themes';

/**
 * Web: mirror the tokens as --ms-* custom properties on :root (so plain CSS
 * and automated render checks see the same values the app uses) and paint the
 * document background, text colour and font from them.
 */
export function applyThemeToDocument(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  applyCssVariables(theme, root);
  root.style.setProperty('color-scheme', theme.scheme);
  document.body.style.backgroundColor = theme.colors.paper;
  document.body.style.color = theme.colors.ink;
  document.body.style.fontFamily = `${theme.fonts.body}, system-ui, sans-serif`;
}
