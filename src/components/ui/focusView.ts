import { AccessibilityInfo, type View } from 'react-native';

/**
 * Moves the screen reader's focus to `view` (TalkBack reads it out). For a
 * result that replaces the control that produced it, whose focus would
 * otherwise be lost.
 */
export function focusView(view: View | null): void {
  if (view) AccessibilityInfo.sendAccessibilityEvent(view, 'focus');
}

/**
 * Moves focus to `view` when the control that had it has just been swapped
 * for this one (Lend becoming Mark returned). A phone cannot tell where
 * TalkBack's focus was, so it always moves.
 */
export function focusViewIfLost(view: View | null): void {
  focusView(view);
}
