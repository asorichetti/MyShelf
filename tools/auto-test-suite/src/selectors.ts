// The data-testid contract, shared with the app. Testids is generated from
// src/testing/selectors.json by scripts/gen-selectors.mjs; journeys and gates
// build CSS selectors from it through tid() only, so no testid string is ever
// typed twice.
export { Testids } from '../../../src/testing/testids.gen.ts';

/** tid returns the CSS selector for one data-testid. */
export function tid(id: string): string {
  return `[data-testid="${id}"]`;
}
