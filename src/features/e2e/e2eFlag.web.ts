/**
 * Web: the web build is a test target, never shipped to users (ADR 0002), and
 * the auto test suite seeds every journey through /e2e, including against the
 * static export. So the loader is on unless a build opts out with
 * EXPO_PUBLIC_E2E=0. (Android keeps it off unless EXPO_PUBLIC_E2E=1: see
 * e2eFlag.ts and ADR 0015.)
 */
export function isE2eEnabled(): boolean {
  return process.env.EXPO_PUBLIC_E2E !== '0';
}

export { safeNextPath } from './e2eFlag.shared';
