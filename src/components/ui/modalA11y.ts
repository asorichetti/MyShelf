/**
 * Web only (see modalA11y.web.ts). On a phone the Modal is its own window:
 * TalkBack names it from its content and puts focus back when it closes.
 */
export function useReturnFocus(_visible: boolean): void {}

/** Props for the Modal itself; none are needed on a phone. */
export function modalProps(_name: string): Record<string, never> {
  return {};
}

/** Web only: arrow-key movement between a menu's items. */
export function menuKeyProps(): Record<string, never> {
  return {};
}
