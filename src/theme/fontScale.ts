import { useWindowDimensions } from 'react-native';

/**
 * Android and iOS: the system enlarges text itself (the font size setting,
 * up to 200 % on Android 14), so the typography tokens stay as designed and
 * this reports the system's factor for layouts that must make room for it.
 */
export const platformScalesText = true;

export function usePlatformFontScale(): number {
  return useWindowDimensions().fontScale;
}
