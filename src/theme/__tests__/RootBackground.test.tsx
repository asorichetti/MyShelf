import { render } from '@testing-library/react-native';
import * as SystemUI from 'expo-system-ui';

import { darkColors, lightColors, ThemeProvider, type ThemePreference } from '@/theme';
import { RootBackground } from '@/theme/RootBackground';

jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(() => Promise.resolve()) }));
let mockSystemScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockSystemScheme }));

const painted = () => jest.mocked(SystemUI.setBackgroundColorAsync).mock.calls.map(([c]) => c);
const tree = (preference: ThemePreference) => (
  <ThemeProvider initialPreference={preference}>
    <RootBackground />
  </ThemeProvider>
);

afterEach(() => {
  mockSystemScheme = 'light';
  jest.mocked(SystemUI.setBackgroundColorAsync).mockClear();
});

it("paints the root view with the system scheme's paper, and follows it as it changes", () => {
  const { rerender } = render(tree('system'));
  expect(painted()).toEqual([lightColors.paper]);
  mockSystemScheme = 'dark';
  rerender(tree('system'));
  expect(painted()).toEqual([lightColors.paper, darkColors.paper]);
});

it("follows an Appearance choice that differs from the phone's scheme", () => {
  mockSystemScheme = 'light';
  render(tree('dark'));
  expect(painted()).toEqual([darkColors.paper]);
});

it('does not paint again while the paper stays the same', () => {
  const { rerender } = render(tree('light'));
  rerender(tree('light'));
  expect(painted()).toEqual([lightColors.paper]);
});
