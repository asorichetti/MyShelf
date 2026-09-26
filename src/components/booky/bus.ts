import type { BookyEvent } from './engine';
import type { BookyTrigger } from './tips';

/**
 * Booky's event bus: `emitBooky(event)` from anywhere, React or not (the
 * series probe after a save, the overdue check). `BookyProvider` listens and
 * runs the engine; other code may listen for a trigger too (the overdue
 * check listens for `app-foreground`).
 *
 * An array is a list of alternatives in order of preference: the first
 * with a tip to show wins (the most overdue loan not yet nudged today).
 */

export type BookyEmission = BookyEvent | readonly BookyEvent[];
type Listener = (emission: BookyEmission) => void;

const listeners = new Set<Listener>();

export function emitBooky(emission: BookyEmission): void {
  for (const listener of [...listeners]) {
    try {
      listener(emission);
    } catch (error) {
      console.error('A Booky listener failed', error);
    }
  }
}

/** Listens to every emission; returns the unsubscribe function. */
export function subscribeBooky(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Listens for one trigger (in a single event or any alternative of a list). */
export function onBookyEvent(type: BookyTrigger, listener: (event: BookyEvent) => void): () => void {
  return subscribeBooky((emission) => {
    const events = Array.isArray(emission) ? emission : [emission as BookyEvent];
    const match = events.find((e) => e.type === type);
    if (match) listener(match);
  });
}
