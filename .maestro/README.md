# Maestro flows

On-device flows for what only the real Android app can prove: the native
date picker, the camera permission, the share sheet and document picker,
notifications, the back button, font scale, dark mode, offline behaviour,
reading a cover with on-device text recognition and the release build's
first run. The cover-scan flows and their photos are described in
[`cover-scan/README.md`](cover-scan/README.md). How to run the suite, what
each flow checks and the latest results are in
[`docs/device-testing.md`](../docs/device-testing.md).

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

The flows target the E2E build (a release APK with the fixture loader and the
recorded API responses). While writing a flow, a development build is quicker
to iterate with: it loads the JavaScript from Metro, so a change needs no
rebuild. `npm run android` (`expo run:android`) builds and installs one; it
has the fixture loader too (`.env.development`), but uses the real services
unless `.env.local` also sets `EXPO_PUBLIC_E2E_MOCK_API=1`.

## Recorded API responses

Open Library, Google Books and cover requests answer from the recorded
responses the web auto test suite uses (`src/services/metadata/__fixtures__/`),
built into the E2E APK, so no flow depends on those services being up or
fast. Only the flows tagged `live` use the real ones:
`lookup-isbn-online.yaml` (and the suite's `lookup-cover-stored` check after
it), which exist to prove the real network path. A request with no recorded
response fails in the app and fails the suite's `mock-api-unmocked` check,
which lists the URL: record it (`scripts/record-fixture.mjs`), run `npm run
e2eapi:gen` and rebuild. How it works:
[`docs/device-testing.md`](../docs/device-testing.md#recorded-api-responses).

`common/open-fixture.yaml` takes `API: live` for a live flow and
`NETWORK: offline` for a phone with no connection (simulated: every request
fails as it would; `myshelf://e2e/network?state=online&next=/` turns it back
on). A flow that opens its own fixture link gets recorded responses and a
working network. `eas build --local --profile e2e -p android`
builds the E2E APK through EAS instead of `scripts/build-android-apk.sh`
(it needs an Expo login).

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
- Tags: `core` (the suite), `live` (the real Open Library and Google Books:
  the suite runs it separately, retried, and skips it with `--offline`;
  keep these few), `network` (needs the internet: only the `live` flows),
  `files` (needs
  the test files the script pushes to Downloads), `hooked` (the script runs
  it with its own set-up and checks), `production` (the release build),
  `cover-scan` (reads a cover), `needs-photos` (the developer's own cover
  photos, never committed), `manual` (needs a person, e.g. a real book in
  front of the camera).
- `common/` and `cover-scan/` hold subflows, `hooks/` flows the script
  runs between steps, and `cover-scan/photo-*.yaml` the flows that read the
  developer's own cover photos; none is picked up by `maestro test .maestro/`
  (see `config.yaml`). Maestro checks every `addMedia` file of every flow in
  a folder before it runs any, even flows a tag excludes, so a flow whose
  media may be missing must live in a subfolder.
- Save screenshots under `screenshots/` with `takeScreenshot`, and look at them.
