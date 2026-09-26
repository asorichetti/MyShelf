import { ErrorBoundary } from '@/components/ui';
import { crashCaught, E2eCrashProbe } from '@/features/e2e/crashSwitch';

import { ScreenErrorScreen } from './ScreenErrorScreen';

import type { ReactElement, ReactNode } from 'react';

/**
 * One screen's error boundary (P09-04): a render error in the screen shows
 * `ScreenErrorScreen` in its place, and nothing else goes blank. The E2E
 * crash probe sits inside it, so a journey can make exactly this screen throw.
 */
export function ScreenErrorBoundary({ name, children }: { name: string; children: ReactNode }) {
  return (
    <ErrorBoundary fallback={(props) => <ScreenErrorScreen {...props} where={name} />} onError={() => crashCaught(name)}>
      <E2eCrashProbe route={name} />
      {children}
    </ErrorBoundary>
  );
}

/** A navigator's `screenLayout`: every screen of that navigator gets its own boundary. */
export function screenErrorLayout({ route, children }: { route: { name: string }; children: ReactElement }): ReactElement {
  return <ScreenErrorBoundary name={route.name}>{children}</ScreenErrorBoundary>;
}

/**
 * The last resort around the whole app below the database (Booky's overlay,
 * the snackbar host, the navigators): if something there throws, the app
 * shows the same friendly screen with "Try again" instead of going blank.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary fallback={(props) => <ScreenErrorScreen {...props} where="app" />}>{children}</ErrorBoundary>;
}
