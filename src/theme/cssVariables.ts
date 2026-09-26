import type { Theme } from './themes';
import { typography } from './tokens';

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Flattens a theme into CSS custom properties, e.g. `--ms-color-primary`,
 * `--ms-space-lg`, `--ms-radius-md`, `--ms-font-heading`.
 */
export function themeToCssVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.colors)) vars[`--ms-color-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(theme.spacing)) vars[`--ms-space-${kebab(k)}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.sizes)) vars[`--ms-size-${kebab(k)}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.radii)) vars[`--ms-radius-${kebab(k)}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.fonts)) vars[`--ms-font-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(theme.elevation)) vars[`--ms-elevation-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(typography)) {
    vars[`--ms-text-${kebab(k)}-size`] = `${v.fontSize}px`;
    vars[`--ms-text-${kebab(k)}-weight`] = v.fontWeight;
  }
  return vars;
}

/** Writes the theme's variables onto the given element (normally `:root`). */
export function applyCssVariables(theme: Theme, el: { style: { setProperty(n: string, v: string): void } }) {
  for (const [name, value] of Object.entries(themeToCssVariables(theme))) el.style.setProperty(name, value);
}
