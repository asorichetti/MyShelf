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
