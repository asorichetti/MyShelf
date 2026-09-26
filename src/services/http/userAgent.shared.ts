export const PROJECT_URL = 'https://github.com/asorichetti/MyShelf';

/** `MyShelf/<version> (+<repo>)`, as PLAN §6 asks every request to carry. */
export function formatUserAgent(version: string | null | undefined): string {
  return `MyShelf/${version || 'dev'} (+${PROJECT_URL})`;
}
