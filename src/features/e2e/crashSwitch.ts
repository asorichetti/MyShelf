import { isE2eEnabled } from './e2eFlag';

/**
 * The E2E crash trigger (P09-04): `/e2e?…&crash=<route>` arms a render error
 * in that route's screen (`loans`, `book/[id]`, …), so a journey can prove
 * the screen's error boundary catches it. The screen keeps throwing until a
 * boundary has shown the error; then "Try again" renders it normally. Only
 * in builds with the E2E loader (ADR 0015); everywhere else arming does
 * nothing and the probe renders nothing.
 */
const armed = new Set<string>();

export class E2eCrash extends Error {
  override name = 'E2eCrash';
}

export function armCrash(route: string): void {
  if (isE2eEnabled() && route) armed.add(route);
}

/** Called by a screen's error boundary once it has shown the error. */
export function crashCaught(route: string): void {
  armed.delete(route);
}

/** Rendered first inside each screen's error boundary: throws while its route is armed. */
export function E2eCrashProbe({ route }: { route: string }): null {
  if (armed.size && armed.has(route)) throw new E2eCrash(`E2E crash test: the ${route} screen threw on purpose`);
  return null;
}
