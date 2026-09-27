/** Web only (see eventHook.web.ts): a phone has no page for a test to reach into. */
export function installE2eEventHook(): void {}

/** Web only: notes a value for journeys to read (`window.__myshelfE2e.notes[key]`). A no-op on a phone. */
export function noteForE2e(_key: string, _value: unknown): void {}
