# Maestro flows

On-device flows for what only the real Android app can prove: the native
date picker, the camera permission, the share sheet and document picker,
notifications, the back button, font scale, dark mode, offline behaviour and
the release build's first run. How to run them, what each checks and the
latest results are in [`docs/device-testing.md`](../docs/device-testing.md).

## Run

```bash
scripts/build-android-apk.sh e2e          # build/myshelf-e2e.apk (fixture loader on)
scripts/build-android-apk.sh production   # build/myshelf-production.apk (optional)
scripts/maestro-suite.sh --e2e-apk build/myshelf-e2e.apk \
  --production-apk build/myshelf-production.apk --device emulator-5554
```

`maestro test .maestro/` on its own runs every flow except those tagged
`manual`; the ones tagged `hooked` or `production` then need the device set
up by hand as described at the top of each file, so prefer the script.
One flow: `maestro --device emulator-5554 test .maestro/book-add-manual.yaml`.

## Writing a flow

- Target elements by `id:` with the test ids from `src/testing/selectors.json`
  (React Native's `testID` is the Android resource id Maestro reads), or by
  the text or accessibility label the user sees. Where a control groups its
  children into one accessible element (a book row, a lookup result), match
  its label: `{ id: home-row, text: 'Dune,.*' }`.
- Start from a fixture with `common/open-fixture.yaml` (env `FIXTURE`, `NEXT`).
  It clears the app's data and cold-starts it on the E2E deep link, so there
  is never a screen from before the load to confuse a wait. Only E2E builds
  have the loader (ADR 0015).
- Wait on conditions (`extendedWaitUntil`, `scrollUntilVisible`), never on
  fixed sleeps.
- Tags: `core` (the suite), `network` (needs the internet), `files` (needs
  the test files the script pushes to Downloads), `hooked` (the script runs
  it with its own set-up and checks), `production` (the release build),
  `manual` (needs a person, e.g. a real book in front of the camera).
- `common/` holds subflows and `hooks/` flows the script runs between steps;
  neither is picked up by `maestro test .maestro/` (see `config.yaml`).
- Save screenshots under `screenshots/` with `takeScreenshot`, and look at them.
