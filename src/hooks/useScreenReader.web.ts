/**
 * Web: browsers do not say whether a screen reader is running, and
 * react-native-web answers "yes" to be safe. The web build is a test target
 * (ADR 0002), so it behaves like a phone with TalkBack off; everything
 * screen-reader specific is checked in Jest and on the device.
 */
export function useScreenReader(): boolean {
  return false;
}
