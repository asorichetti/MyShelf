import { useEffect, useRef } from 'react';

/** Calls `onEscape` when Escape is pressed anywhere on the page, while `onEscape` is not null. */
export function useEscapeKey(onEscape: (() => void) | null): void {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  }, [onEscape]);
  const active = onEscape != null;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) handler.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
}
