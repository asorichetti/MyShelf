import { useEffect, useRef, useState } from 'react';

import type { View } from 'react-native';

/** The last few elements that had focus, newest last, for when a modal's opener is gone by the time it closes. */
const history: HTMLElement[] = [];
let tracking = false;

function trackFocus(): void {
  if (tracking || typeof document === 'undefined') return;
  tracking = true;
  document.addEventListener(
    'focusin',
    (e) => {
      if (!(e.target instanceof HTMLElement)) return;
      history.push(e.target);
      if (history.length > 100) history.shift();
    },
    true,
  );
}

/**
 * Where focus should go back to: the opener; or else the modal's named
 * fallback, if it is on the page; or else the latest earlier focus that is
 * still on the page and not in a modal.
 */
export function returnTarget(opener: HTMLElement, earlier: readonly HTMLElement[], fallback?: HTMLElement | null): HTMLElement | null {
  if (opener.isConnected) return opener;
  if (fallback?.isConnected) return fallback;
  return [...earlier].reverse().find((el) => el.isConnected && !el.closest('[aria-modal="true"]')) ?? null;
}

function focusedElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const el = document.activeElement;
  return el instanceof HTMLElement && el !== document.body ? el : null;
}

/**
 * Web: gives focus back to whatever had it when the modal opened (the
 * button that opened a sheet, a menu or a dialog) once it closes (P09-01).
 * react-native-web's Modal tries too, but it remembers the element focused
 * when its own effect runs, which is already the sheet's first field when
 * that field takes focus as it mounts, so closing such a sheet dropped focus
 * on the page body. The opener is noted while rendering the modal visible,
 * before anything inside it can take focus; focus goes back only if it was
 * lost, so a screen that deliberately moves focus elsewhere keeps its choice.
 * If the opener has gone meanwhile (the "More help" button of a Booky tip
 * that closed as the help sheet opened), focus goes to an earlier control
 * that is still there: `fallback` if the modal names one (the help sheet
 * names the help button), else see `returnTarget`.
 */
export function useReturnFocus(visible: boolean, fallback?: () => View | null): void {
  trackFocus();
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);
  const [shown, setShown] = useState(false);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  if (visible !== shown) {
    setShown(visible);
    if (visible) setOpener(focusedElement());
  }
  useEffect(() => {
    if (!visible || !opener) return;
    return () => {
      // After the Modal has unmounted and its own focus trap has let go.
      setTimeout(() => {
        const now = document.activeElement;
        const lost = now == null || now === document.body || !now.isConnected;
        if (lost) returnTarget(opener, history, fallbackRef.current?.() as unknown as HTMLElement | null)?.focus();
      }, 0);
    };
  }, [visible, opener]);
}

/**
 * Web: react-native-web wraps a Modal's content in its own `role="dialog"`
 * element, which had no name (axe: aria-dialog-name). Naming it after the
 * sheet, menu or dialog inside means a screen reader never meets an unnamed
 * dialog.
 */
export function modalProps(name: string): { 'aria-label': string } {
  return { 'aria-label': name };
}

/**
 * Web: the arrow keys, Home and End move between a menu's items, as the
 * WAI-ARIA menu pattern (and a screen reader in a menu) expects; Tab still
 * works too.
 */
export function menuKeyProps(): { onKeyDown: (e: { key: string; currentTarget: unknown; preventDefault: () => void }) => void } {
  return {
    onKeyDown(e) {
      const menu = e.currentTarget as HTMLElement;
      const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
      if (!items.length) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === 'ArrowDown' ? (at + 1) % items.length
        : e.key === 'ArrowUp' ? (at <= 0 ? items.length - 1 : at - 1)
        : e.key === 'Home' ? 0
        : e.key === 'End' ? items.length - 1
        : null;
      if (next == null) return;
      e.preventDefault();
      items[next]!.focus();
    },
  };
}
