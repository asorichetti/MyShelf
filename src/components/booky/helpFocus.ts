import type { View } from 'react-native';

let last: View | null = null;

/**
 * The help button last pressed, so the help sheet can give it focus back
 * when it closes: the sheet is opened from Booky's tip ("More help"), and
 * the tip has gone by then.
 */
export function rememberHelpButton(button: View | null): void {
  last = button;
}

export function lastHelpButton(): View | null {
  return last;
}
