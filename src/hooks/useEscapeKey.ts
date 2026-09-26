/** Web only: calls `onEscape` when Escape is pressed. Phones have no Escape key (Android back is handled by each screen). */
export function useEscapeKey(_onEscape: (() => void) | null): void {}
