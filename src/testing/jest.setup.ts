// Gesture handler's native module is replaced by its own Jest mocks; gestures are driven with `fireGestureHandler`.
import 'react-native-gesture-handler/jestSetup';

// Reanimated and its worklets runtime have no native side in Jest: use their own mocks,
// under which shared values update at once and gesture callbacks run on the JS thread.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

// Vector icons load their font asynchronously and re-render when it arrives,
// which produces act() warnings in tests. Render a plain placeholder instead.
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const Icon = ({ name, testID }: { name: string; testID?: string }) =>
    createElement(Text, { testID, accessibilityElementsHidden: true }, `icon:${name}`);
  return { __esModule: true, default: Icon };
});

// expo-notifications needs a native module; tests get an in-memory fake they can inspect.
jest.mock('expo-notifications', () => jest.requireActual('./mocks/expoNotifications'));

// Tests never reach the network: code that fetches without an injected
// `fetch` (e.g. the cover backfill the tab shell starts) sees it offline.
global.fetch = jest.fn(async (input: unknown) => {
  throw new TypeError(`Network request failed: tests do not use the network (${String(input)})`);
}) as unknown as typeof fetch;

// React Native's Jest preset reports a system font scale of 2; tests render
// at the designed 100 % unless they set a font scale on ThemeProvider.
jest.mock('@/theme/fontScale', () => ({ platformScalesText: true, usePlatformFontScale: () => 1 }));
