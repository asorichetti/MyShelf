// Small error helpers shared by every module.

/** The message of anything thrown. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * joinErrors combines several errors into one whose message is their messages,
 * one per line, skipping empty entries. It returns undefined when there is
 * nothing to report, so `const err = joinErrors(errs); if (err) ...` reads
 * like Go's errors.Join.
 */
export function joinErrors(errs: ReadonlyArray<unknown>): Error | undefined {
  const real = errs.filter((e) => e !== undefined && e !== null);
  if (real.length === 0) return undefined;
  if (real.length === 1 && real[0] instanceof Error) return real[0];
  return new Error(real.map(errorMessage).join('\n'));
}
