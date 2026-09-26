/**
 * Web: react-native-web writes font sizes in px, so nothing enlarges text on
 * its own. The theme scales the typography tokens instead when it is given a
 * font scale (the web E2E build's large-text emulation, P09-01), the way
 * Android's font size setting scales every Text.
 */
export const platformScalesText = false;

export function usePlatformFontScale(): number {
  return 1;
}
