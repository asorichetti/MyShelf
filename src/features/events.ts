import { useEffect, useRef } from 'react';

/** Things that changed in the database, so screens showing them can reload. */
export type LibraryEvent = 'library-changed' | 'loans-changed' | 'groups-changed' | 'settings-changed';

type Listener = (event: LibraryEvent) => void;

const listeners = new Map<LibraryEvent, Set<Listener>>();

/** Subscribes to an event; returns the unsubscribe function. */
export function subscribe(event: LibraryEvent, listener: Listener): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/** Tells every subscriber that something changed. Call after a write commits. */
export function emit(event: LibraryEvent): void {
  // Copy first: a listener may unsubscribe (or subscribe) while we notify.
  for (const listener of [...(listeners.get(event) ?? [])]) {
    try {
      listener(event);
    } catch (error) {
      console.error(`A ${event} listener failed`, error);
    }
  }
}

/** Number of subscribers (tests). */
export function listenerCount(event: LibraryEvent): number {
  return listeners.get(event)?.size ?? 0;
}

/**
 * Calls `onEvent` whenever any of `events` is emitted, for as long as the
 * component is mounted. The latest `onEvent` is always used, so it need not
 * be memoised.
 */
export function useLibraryEvent(events: LibraryEvent | readonly LibraryEvent[], onEvent: Listener): void {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  const key = (Array.isArray(events) ? events : [events]).join('|');
  useEffect(() => {
    const unsubscribes = (key.split('|') as LibraryEvent[]).map((e) => subscribe(e, (ev) => handler.current(ev)));
    return () => unsubscribes.forEach((u) => u());
  }, [key]);
}
