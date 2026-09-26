/**
 * Whether this build may load E2E fixtures. Metro inlines `EXPO_PUBLIC_*`
 * variables at build time, so a production build carries the literal value;
 * `.env.development` turns it on for `expo start` only.
 */
export function isE2eEnabled(): boolean {
  return process.env.EXPO_PUBLIC_E2E === '1';
}

/** Only in-app paths are allowed as a redirect target. */
export function safeNextPath(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
