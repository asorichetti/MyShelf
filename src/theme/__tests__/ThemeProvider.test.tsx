import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { darkTheme, lightTheme, resolveScheme, ThemeProvider, useTheme, useThemePreference, type Theme, type ThemePreference } from '@/theme';

let mockSystemScheme: 'light' | 'dark' | null = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockSystemScheme }));

const report = jest.fn<void, [Theme, (p: ThemePreference) => void]>();
function Probe() {
  report(useTheme(), useThemePreference().setPreference);
  return <Text>probe</Text>;
}
const seen = () => report.mock.lastCall?.[0];
const setPreference = (p: ThemePreference) => report.mock.lastCall![1](p);

afterEach(() => {
  mockSystemScheme = 'light';
  report.mockClear();
});

describe('resolveScheme', () => {
  it('follows the system for System, and ignores it otherwise', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('sepia' as ThemePreference, 'dark')).toBe('dark');
  });
});

describe('ThemeProvider (P09-02)', () => {
  it('follows the system scheme by default', () => {
    mockSystemScheme = 'dark';
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(seen()).toBe(darkTheme);
  });

  it('switches when the preference changes, and back to the system with System', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(seen()).toBe(lightTheme);
    act(() => setPreference('dark'));
    expect(seen()).toBe(darkTheme);
    act(() => setPreference('system'));
    expect(seen()).toBe(lightTheme);
  });

  it('lets a forced scheme or theme win over the preference', () => {
    mockSystemScheme = 'dark';
    render(
      <ThemeProvider scheme="light" initialPreference="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(seen()).toBe(lightTheme);
    render(
      <ThemeProvider theme={darkTheme} scheme="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(seen()).toBe(darkTheme);
  });
});
