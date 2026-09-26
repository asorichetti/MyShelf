/**
 * Moves keyboard focus to the first button inside `el`. Android and iOS have
 * no keyboard focus to keep; the screen reader hears the live announcement
 * instead, so this is a no-op there (see focusWithin.web.ts).
 */
export function focusWithin(_el: unknown): void {}
