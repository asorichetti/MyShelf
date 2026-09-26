/**
 * Android (and iOS): the fixture loader exists only in builds made with
 * EXPO_PUBLIC_E2E=1. Metro inlines `EXPO_PUBLIC_*` at build time, so a release
 * build carries the literal value; `.env.development` turns it on for
 * `expo start` (development builds used with Maestro). The web build has its
 * own rule in e2eFlag.web.ts (ADR 0015).
 */
export function isE2eEnabled(): boolean {
  return process.env.EXPO_PUBLIC_E2E === '1';
}

export { safeNextPath } from './e2eFlag.shared';
