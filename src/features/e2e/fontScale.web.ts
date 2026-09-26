import { isE2eEnabled } from './e2eFlag';

/** Where the chosen scale is kept, so it survives the fixture loader's redirect and reloads in the same tab. */
export const FONT_SCALE_KEY = 'myshelf-e2e-font-scale';

function readStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Web E2E hook (P09-01): loading the app with `?e2e-font-scale=2` (or with
 * `myshelf-e2e-font-scale` already in sessionStorage) draws all text at that
 * factor, 1 to 3, as Android's font size setting would, so the auto test
 * suite can check every screen at 200 % text. `?e2e-font-scale=1` turns it
 * off again. Inert unless the E2E loader is on (ADR 0015).
 */
export function e2eFontScale(): number | undefined {
  if (!isE2eEnabled() || typeof location === 'undefined') return undefined;
  const storage = readStorage();
  const asked = new URLSearchParams(location.search).get('e2e-font-scale');
  if (asked != null) storage?.setItem(FONT_SCALE_KEY, asked);
  const raw = asked ?? storage?.getItem(FONT_SCALE_KEY);
  const scale = raw == null ? NaN : Number(raw);
  return Number.isFinite(scale) && scale >= 1 && scale <= 3 && scale !== 1 ? scale : undefined;
}
