/**
 * @jest-environment node
 */
import { allMessages } from '@/i18n';
import { findHardcodedStrings, formatFinding } from '@/testing/hardcodedStrings';

/**
 * P09-11: user-facing text lives in the catalogue (`src/i18n/en.ts`), not in
 * components. The rules and the allowlist are in `src/testing/hardcodedStrings.ts`;
 * `npx tsx src/testing/hardcodedStrings.ts <path>` lists the offenders.
 */
it('keeps user-facing strings in the catalogue', () => {
  const keys = allMessages();
  const root = `${__dirname}/../../..`;
  const offenders = findHardcodedStrings(root, (s) => keys.has(s)).map(formatFinding);
  expect(offenders).toEqual([]);
});
