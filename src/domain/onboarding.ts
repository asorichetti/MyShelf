/**
 * The first-run experience (P07-03): the onboarding cards and Booky's
 * welcome tips (the empty shelf, the first visit to Scan).
 *
 * `onboarding.done` is null on a fresh install, true once the onboarding is
 * finished or skipped, and false when an E2E fixture asks for a first run.
 * E2E builds load fixtures for every test, so there a fresh install is
 * treated as already welcomed unless the fixture asks (`first-run`); existing
 * journeys never meet the onboarding by surprise.
 */

/** Whether to send the user to the onboarding now. */
export function needsOnboarding(done: boolean | null, e2e: boolean): boolean {
  return e2e ? done === false : done !== true;
}

/** Whether Booky's welcome tips may show. */
export function welcomeTipsOn(done: boolean | null, e2e: boolean): boolean {
  return e2e ? done !== null : true;
}
