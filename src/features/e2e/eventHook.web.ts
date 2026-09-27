import { emit, subscribe, type LibraryEvent } from '@/features/events';

import { isE2eEnabled } from './e2eFlag';

/** What the E2E build puts on `window` for the auto test suite. */
export interface E2eWindowHook {
  /** Emits a library event as a background write would (a cover arriving, a lookup finishing). */
  emit: (event: LibraryEvent) => void;
  /**
   * How many times each event has been emitted since the page loaded. Every
   * write emits its event after it commits, so a journey that waits for the
   * count to go up knows the save has landed (before a reload, say).
   */
  counts: Partial<Record<LibraryEvent, number>>;
  /**
   * Values the app notes for journeys, oldest first, per key (`noteForE2e`):
   * `backup-check` gets whether each start-up backup check found one due.
   */
  notes: Record<string, unknown[]>;
}

/** The name of the hook on `window`. */
export const E2E_HOOK = '__myshelfE2e';

/** Every event, so the hook can count them all (a new event must be added here to compile). */
const EVERY_EVENT: Record<LibraryEvent, true> = {
  'library-changed': true,
  'loans-changed': true,
  'groups-changed': true,
  'settings-changed': true,
  'pending-changed': true,
  'pending-retry': true,
};

/**
 * Web E2E hook: `window.__myshelfE2e.emit('library-changed')` makes every
 * screen reload as if a background write had just committed, so a journey
 * can prove the screen keeps keyboard focus through a reload it did not ask
 * for; `window.__myshelfE2e.counts` tells a journey when a write has
 * committed. Inert unless the E2E loader is on (ADR 0015).
 */
export function installE2eEventHook(): void {
  if (!isE2eEnabled() || typeof window === 'undefined') return;
  const hook: E2eWindowHook = { emit, counts: {}, notes: {} };
  for (const event of Object.keys(EVERY_EVENT) as LibraryEvent[]) {
    subscribe(event, () => {
      hook.counts[event] = (hook.counts[event] ?? 0) + 1;
    });
  }
  (window as unknown as Record<string, E2eWindowHook>)[E2E_HOOK] = hook;
}

/** Notes a value for journeys (see `E2eWindowHook.notes`); nothing unless the hook is installed. */
export function noteForE2e(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  const hook = (window as unknown as Record<string, E2eWindowHook | undefined>)[E2E_HOOK];
  if (hook) (hook.notes[key] ??= []).push(value);
}
