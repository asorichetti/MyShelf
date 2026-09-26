import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The last answer the OS gave, so later mounts know at once (null until the first answer). */
let known: boolean | null = null;

/**
 * Whether the user has asked the OS to reduce motion (web: the
 * `prefers-reduced-motion` media query), or null while that is not yet known.
 * Anything that animates on mount should wait for a definite `false`.
 */
export function useReducedMotionState(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(known);
  useEffect(() => {
    let active = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled())
      .then((value) => {
        known = Boolean(value);
        if (active) setReduced(known);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      known = Boolean(value);
      setReduced(known);
    });
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/** True when the user has asked the OS to reduce motion (false until known). */
export function useReducedMotion(): boolean {
  return useReducedMotionState() ?? false;
}

/** Tests: forget the cached answer. */
export function resetReducedMotionCache(): void {
  known = null;
}
