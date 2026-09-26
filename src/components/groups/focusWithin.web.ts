/** Moves keyboard focus to the first enabled button inside `el` (a DOM node on web). */
export function focusWithin(el: unknown): void {
  const node = el as HTMLElement | null;
  const button = node?.querySelector?.<HTMLElement>('[role="button"]:not([aria-disabled="true"])');
  button?.focus();
}
