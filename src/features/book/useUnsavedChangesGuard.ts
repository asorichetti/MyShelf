import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useBeforeUnload } from '@/hooks/useBeforeUnload';

type NavigationAction = { type: string; payload?: object; source?: string; target?: string };
type BeforeRemoveEvent = { preventDefault: () => void; data: { action: NavigationAction } };
type Navigation = {
  addListener: (type: 'beforeRemove', listener: (e: BeforeRemoveEvent) => void) => () => void;
  dispatch: (action: NavigationAction) => void;
};

export interface UnsavedChangesGuard {
  /** True while the "discard changes?" question is showing. */
  asking: boolean;
  /** Leave anyway: carries on with the navigation that was held up. */
  discard: () => void;
  /** Stay on the form. */
  keepEditing: () => void;
  /** Lets the next navigation through without asking (after a save). */
  release: () => void;
}

/**
 * While `active`, leaving the screen (Android back, a back button, a browser
 * back) is held up so the screen can ask first; closing or reloading the web
 * tab gets the browser's own prompt.
 */
export function useUnsavedChangesGuard(active: boolean): UnsavedChangesGuard {
  const navigation = useNavigation() as unknown as Navigation;
  const [pending, setPending] = useState<NavigationAction | null>(null);
  const guarding = useRef(active);
  const released = useRef(false);

  useEffect(() => {
    guarding.current = active;
  }, [active]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!guarding.current || released.current) return;
        e.preventDefault();
        setPending(e.data.action);
      }),
    [navigation],
  );

  useBeforeUnload(active);

  const discard = useCallback(() => {
    released.current = true;
    const action = pending;
    setPending(null);
    if (action) navigation.dispatch(action);
  }, [navigation, pending]);
  const keepEditing = useCallback(() => setPending(null), []);
  const release = useCallback(() => {
    released.current = true;
  }, []);

  return { asking: pending != null, discard, keepEditing, release };
}
