/**
 * Runs once, in Jest's main process, before any test.
 *
 * The test database is Node's built-in SQLite (`src/db/node.ts`), which Node
 * still marks experimental: every process that loads it prints an
 * ExperimentalWarning to stderr. It is expected and harmless, so keep it out
 * of the test output: test workers (started after this) inherit the flag
 * through NODE_OPTIONS, and a run in this process (`--runInBand`, or a single
 * test file) drops the one warning.
 */
export default function globalSetup(): void {
  const flag = '--disable-warning=ExperimentalWarning';
  const options = process.env.NODE_OPTIONS ?? '';
  if (!options.includes(flag)) process.env.NODE_OPTIONS = `${options} ${flag}`.trim();

  const emitWarning = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const type = typeof rest[0] === 'string' ? rest[0] : (rest[0] as { type?: string } | undefined)?.type;
    const message = typeof warning === 'string' ? warning : warning.message;
    if (type === 'ExperimentalWarning' && /^SQLite is an experimental feature/.test(message)) return;
    (emitWarning as (...args: unknown[]) => void)(warning, ...rest);
  }) as typeof process.emitWarning;
}
