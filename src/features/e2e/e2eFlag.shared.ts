/** Only in-app paths are allowed as a redirect target. */
export function safeNextPath(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
