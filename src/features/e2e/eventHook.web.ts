import { emit, type LibraryEvent } from '@/features/events';

import { isE2eEnabled } from './e2eFlag';

/** What the E2E build puts on `window` for the auto test suite. */
export interface E2eWindowHook {
  /** Emits a library event as a background write would (a cover arriving, a lookup finishing). */
  emit: (event: LibraryEvent) => void;
}

/** The name of the hook on `window`. */
export const E2E_HOOK = '__myshelfE2e';

/**
 * Web E2E hook: `window.__myshelfE2e.emit('library-changed')` makes every
 * screen reload as if a background write had just committed, so a journey
 * can prove the screen keeps keyboard focus through a reload it did not ask
 * for. Inert unless the E2E loader is on (ADR 0015).
 */
export function installE2eEventHook(): void {
  if (!isE2eEnabled() || typeof window === 'undefined') return;
  const hook: E2eWindowHook = { emit };
  (window as unknown as Record<string, E2eWindowHook>)[E2E_HOOK] = hook;
}
