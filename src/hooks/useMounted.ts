import { useEffect, useRef, type RefObject } from 'react';

/**
 * A ref that is true while the component is mounted, for async work that
 * finishes after an await: `if (mounted.current) setState(…)` keeps a result
 * from landing in a screen that has gone (P09-04). Set in an effect, so it is
 * right again after React's development double mount.
 */
export function useMounted(): RefObject<boolean> {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
