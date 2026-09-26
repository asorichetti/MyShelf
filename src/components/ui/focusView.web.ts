import type { View } from 'react-native';

/**
 * Web: focuses `view` (which needs `tabIndex={-1}`), so a screen reader
 * reads it and the keyboard carries on from there. For a result that
 * replaces the control that produced it, whose focus would otherwise fall
 * back to the page body.
 */
export function focusView(view: View | null): void {
  (view as unknown as HTMLElement | null)?.focus?.();
}
