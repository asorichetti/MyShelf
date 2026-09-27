import { act, render, type RenderOptions } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SnackbarProvider } from '@/components/ui/Snackbar';
import { ThemeProvider } from '@/theme';

import type { ReactElement, ReactNode } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function AppTestProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <SnackbarProvider>{children}</SnackbarProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Host views with a given `role`. Testing Library's `*ByRole` skips views
 * that are not accessible elements, such as a list item wrapping a button.
 */
export function hostsWithRole(root: ReactTestInstance, role: string): ReactTestInstance[] {
  return root.findAll((n) => typeof n.type === 'string' && n.props.role === role);
}

/** Renders inside the same theme and safe-area providers the app uses. */
export function renderWithTheme(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AppTestProviders, ...options });
}

/**
 * Lets work a component started on mount and finishes on a resolved promise
 * land inside act(): the OS's reduce-motion answer (Booky, covers, sheets and
 * dialogs wait for it) or a first database read. Await it after a render when
 * the test would otherwise end with that update still pending.
 */
export async function settle(): Promise<void> {
  await act(async () => {});
}
