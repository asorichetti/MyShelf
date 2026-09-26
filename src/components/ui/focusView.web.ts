import type { View } from 'react-native';

/**
 * Web: focuses `view` (a control, or a view with `tabIndex={-1}`), so a
 * screen reader reads it and the keyboard carries on from there. For a
 * result that replaces the control that produced it, whose focus would
 * otherwise fall back to the page body.
 */
export function focusView(view: View | null): void {
  (view as unknown as HTMLElement | null)?.focus?.();
}

/** Web: focuses `view` only if focus has fallen to the page (its control was swapped for this one). */
export function focusViewIfLost(view: View | null): void {
  const now = document.activeElement;
  if (now == null || now === document.body || !now.isConnected) focusView(view);
}
