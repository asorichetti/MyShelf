import { useEffect } from 'react';

/** Roles Enter activates that react-native-web leaves to the browser, which does nothing for a `div`. */
const ENTER_ROLES = new Set(['link']);
/** Roles Space activates (WAI-ARIA), beyond the buttons react-native-web already handles. */
const SPACE_ROLES = new Set(['checkbox', 'radio', 'switch', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option']);
/** Controls the browser already operates with both keys. */
const NATIVE = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);

/** The pressable `div` a key press should activate, or null when the browser or react-native-web already does. */
export function keyActivationTarget(e: Pick<KeyboardEvent, 'key' | 'target' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'repeat'>): HTMLElement | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return null;
  const el = e.target;
  if (!(el instanceof HTMLElement) || NATIVE.has(el.tagName) || el.isContentEditable) return null;
  if (el.getAttribute('aria-disabled') === 'true') return null;
  const role = el.getAttribute('role') ?? '';
  // An <a> follows its link on Enter by itself (the tab bar's tabs are links); Space it ignores.
  if (e.key === 'Enter' && ENTER_ROLES.has(role) && el.tagName !== 'A') return el;
  if ((e.key === ' ' || e.key === 'Spacebar') && SPACE_ROLES.has(role)) return el;
  return null;
}

/**
 * Web: makes the keyboard work on every pressable, whatever its role
 * (P09-01). react-native-web activates a Pressable with Enter, and with
 * Space only when its role is `button`; a `link` it leaves to the browser,
 * which ignores Enter on a `div`. So Enter did nothing on the Settings rows,
 * the series, author and genre rows and the series links, and Space did
 * nothing on checkboxes, radios, switches and tabs. This listens once for the
 * whole app, in the capture phase (react-native-web stops the key events it
 * handles), and clicks the focused element for those keys; the Pressable
 * turns the click into its onPress. Space also stops scrolling the page.
 */
export function useKeyboardActivation(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = keyActivationTarget(e);
      if (!target) return;
      e.preventDefault();
      target.click();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
