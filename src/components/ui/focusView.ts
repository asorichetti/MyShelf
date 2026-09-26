import { AccessibilityInfo, type View } from 'react-native';

/**
 * Moves the screen reader's focus to `view` (TalkBack reads it out). For a
 * result that replaces the control that produced it, whose focus would
 * otherwise be lost.
 */
export function focusView(view: View | null): void {
  if (view) AccessibilityInfo.sendAccessibilityEvent(view, 'focus');
}
