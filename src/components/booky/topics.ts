import { NavigationContext } from 'expo-router/react-navigation';
import { useContext, useEffect, useSyncExternalStore } from 'react';

/**
 * What the screen in front already shows (PLAN §8): `book:10` on that book's
 * page, `borrower:3` on Priya's page, `loans` on the Loans tab,
 * `series:2` on a series page. A tip about one of these (its event's
 * `topics`) is not floated over that screen: the screen says it already, in
 * place, next to the control that acts on it ("Mark returned"), and a bubble
 * would only cover that control. The tip is not used up; it can show later
 * elsewhere.
 *
 * A module-level store, like the layers: a screen registers its topics
 * while it is focused (`useBookyTopic`), so a screen left underneath in a
 * stack does not count.
 */

const counts = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version++;
  for (const l of [...listeners]) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getVersion = () => version;

/** Whether any of `topics` is on the screen in front now. */
export function topicOnScreen(topics: readonly string[] | undefined): boolean {
  return !!topics?.some((t) => (counts.get(t) ?? 0) > 0);
}

/** Re-renders when screens come and go; returns a counter that changes with them. */
export function useTopicsVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

/** Registers `topic` as on screen; returns its remover. */
export function addTopic(topic: string): () => void {
  counts.set(topic, (counts.get(topic) ?? 0) + 1);
  changed();
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    const n = (counts.get(topic) ?? 1) - 1;
    if (n > 0) counts.set(topic, n);
    else counts.delete(topic);
    changed();
  };
}

/**
 * Marks what this screen shows while it is focused (a screen rendered on its
 * own, outside a navigator, while it is mounted). `null` (an id still
 * unknown) registers nothing.
 */
export function useBookyTopic(topic: string | null): void {
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    if (topic == null) return;
    if (!navigation) return addTopic(topic);
    let remove: (() => void) | null = navigation.isFocused() ? addTopic(topic) : null;
    const offFocus = navigation.addListener('focus', () => {
      remove ??= addTopic(topic);
    });
    const offBlur = navigation.addListener('blur', () => {
      remove?.();
      remove = null;
    });
    return () => {
      offFocus();
      offBlur();
      remove?.();
    };
  }, [navigation, topic]);
}

/** Tests: forget every topic. */
export function resetTopics(): void {
  counts.clear();
  changed();
}
