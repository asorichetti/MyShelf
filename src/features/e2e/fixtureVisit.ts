import { AppState, type NativeEventSubscription } from 'react-native';

/**
 * Whether this visit to the app (from coming to the foreground until it next
 * goes to the background) started at the E2E fixture loader. The start-up
 * checks that listen for Booky's `app-foreground` (the overdue nudge, the
 * backup reminder) stay quiet for such a visit: a test starts there, on a
 * library it has just loaded.
 *
 * Checking the route when the event arrives is not enough. On a slow phone
 * or emulator the start-up `app-foreground` (a timer after the first render)
 * and Android's resume can arrive after the loader has finished and moved on
 * to the fixture's screen, and the nudge would then float over it.
 *
 * Going to the background ends the visit, so coming back is a real
 * foreground again, as it is for everyone else.
 */
let visiting = false;
let subscription: NativeEventSubscription | null = null;

/** The fixture loader has started: this visit is a test's. */
export function beginFixtureVisit(): void {
  visiting = true;
  subscription ??= AppState.addEventListener('change', (state) => {
    if (state === 'background') visiting = false;
  });
}

/** Whether this visit started at the fixture loader. */
export function inFixtureVisit(): boolean {
  return visiting;
}

/** For tests: forget the visit and the listener. */
export function resetFixtureVisit(): void {
  visiting = false;
  subscription?.remove();
  subscription = null;
}
