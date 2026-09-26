import type { TipBox } from './tipBox';

/**
 * Android and iOS: nothing to do here. TalkBack moves through the screen
 * itself, and the screen's scroller has room below its content for the tip
 * (`useFloatClearance`), so every control can be scrolled clear of it.
 * The web build scrolls a focused control clear (`keepClear.web.ts`).
 */
export function useKeepFocusClear(_box: TipBox | null, _host: { current: unknown }, _gap: number): void {}
