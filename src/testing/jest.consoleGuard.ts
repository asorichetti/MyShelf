/**
 * Fails any test that writes to the console (error, warn, log, info or debug)
 * without saying it expects to. React's act() warnings, a hook that logs a caught failure and
 * a stray debugging line all land here, so noise cannot creep back into the
 * test output unnoticed.
 *
 * A test that means to trigger an error silences and checks it itself:
 *
 *   const error = jest.spyOn(console, 'error').mockImplementation(() => {});
 *   // ... the code under test logs ...
 *   expect(error).toHaveBeenCalledWith('Could not load the loans', expect.any(Error));
 *   error.mockRestore();
 *
 * The spy replaces the guard for as long as it is installed, and the guard is
 * put back before every test, so a spy a test forgot to restore cannot hide
 * the next test's output.
 */
import { format } from 'node:util';

const levels = ['error', 'warn', 'log', 'info', 'debug'] as const;
type Level = (typeof levels)[number];

/**
 * Messages that may appear without failing a test, each with the reason.
 * Keep this empty unless a library logs something no test can prevent.
 */
const allowed: { level: Level; pattern: RegExp; reason: string }[] = [];

let unexpected: string[] = [];

function install(): void {
  for (const [level, fn] of guards) console[level] = fn;
}

function guard(level: Level) {
  return (...args: unknown[]) => {
    const message = format(...args);
    if (allowed.some((a) => a.level === level && a.pattern.test(message))) return;
    unexpected.push(`console.${level}: ${message}`);
  };
}

const guards = levels.map((level) => [level, guard(level)] as const);
install();

function report(when: string): void {
  if (unexpected.length === 0) return;
  const found = unexpected;
  unexpected = [];
  const shown = found.map((m) => (m.length > 2000 ? `${m.slice(0, 2000)}…` : m)).join('\n\n');
  throw new Error(
    `${when} wrote to the console ${found.length === 1 ? 'once' : `${found.length} times`} without expecting it. ` +
      `Fix the cause, or spy on the console in the test and assert on what it logs.\n\n${shown}`,
  );
}

/** Logged between tests: in a previous test's later afterEach hooks, or by work it left running. */
let carried: string[] = [];

beforeEach(() => {
  install();
  carried = unexpected;
  unexpected = [];
});

afterEach(() => {
  const before = carried;
  carried = [];
  if (before.length > 0) {
    unexpected = [...before, ...unexpected];
    report('Before this test (loading the file, beforeAll, or work an earlier test left running), the test file');
  }
  report('This test');
});

afterAll(() => report('The test file (in its last afterEach, afterAll, or work its last test left running)'));
