/**
 * How a scrolling list or form treats the on-screen keyboard: dragging puts it
 * away. The web has no on-screen keyboard, and React Native Web's `on-drag`
 * blurs the focused field on every scroll event, even the one that brings a
 * just-focused field into view (`keyboardDismiss.web.ts`).
 */
export const keyboardDismissMode = 'on-drag' as const;
