/**
 * Web: react-native-web only turns on a modal's focus trap and Escape key
 * once its open animation reports `animationend`, which is not reliable, so
 * dialogs open without one (the web build is a test target, ADR 0002).
 */
export const MODAL_ANIMATION = 'none' as const;

/** Sheets too, for the same reason. */
export const SHEET_ANIMATION = 'none' as const;
