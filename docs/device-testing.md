# Device testing

How MyShelf is tested in the real Android app, and the results of the final
device regression (P00-18, P09-10). The web build and its auto test suite
cover most behaviour ([`PLAN.md` §10](../PLAN.md#10-testing-strategy)); this
is for what only the Android build can show: native widgets and system
dialogs, the network stack, files, notifications, fonts and the release
build itself.

## The two builds

| Build | Command | Output | Use |
|---|---|---|---|
| E2E | `scripts/build-android-apk.sh e2e` | `build/myshelf-e2e.apk` | Maestro. The fixture loader is in (`EXPO_PUBLIC_E2E=1`, [ADR 0015](adr/0015-e2e-fixture-loader-per-platform.md)): `myshelf://e2e?fixture=<name>&next=<route>` wipes the library and loads a fixture, `myshelf://e2e/scan?isbn=<isbn>` injects a barcode read. So are the [recorded API responses](#recorded-api-responses) (`EXPO_PUBLIC_E2E_MOCK_API=1`). Never give it to anyone. |
| Production | `scripts/build-android-apk.sh production` | `build/myshelf-production.apk` | What users install (`EXPO_PUBLIC_E2E=0`, `EXPO_PUBLIC_E2E_MOCK_API=0`): the E2E links are a "Page not found" and touch nothing, and the recorded responses are not in the bundle. The first-run flow runs on it. |

Both are release builds (Hermes, minified, shrunk with R8, no Metro), signed
with the debug key unless the `MYSHELF_UPLOAD_*` values are set
([`release.md`](release.md)). The script runs `npx expo prebuild --platform
android --clean` and `./gradlew assembleRelease` for arm64-v8a (about three
minutes warm, seven cold); `ABIS=x86_64` builds for an Intel emulator (CI)
and `ABIS=all` the universal APK. It needs JDK 17 and the Android SDK:

```bash
export JAVA_HOME=$(ls -d ~/Library/Java/jdk-17*/Contents/Home | head -1)   # macOS; any JDK 17
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
```

## Recorded API responses

A flow that looked books up in the real Open Library could fail because Open
Library was slow: run 36352469638 failed `cover-scan-synthetic` with the
app's "I can't reach the library catalogues right now" (the HTTP client's
10 s timeout, an `OfflineError`; the text recognition had read "THE COLOUR OF
MAGIC" and "TERRY PRATCHETT" correctly). So the E2E APK answers Open Library,
Google Books and cover requests from the **same recorded responses the web
auto test suite serves with `--mock-api`**
(`src/services/metadata/__fixtures__/index.json`) and the same synthetic test
covers, and only the flows tagged `live` use the real services.

- **Inside the HTTP client's `fetch`**, nothing else:
  `src/features/lookup/metadataService.ts` passes `e2eApiFetch()`
  (`src/features/e2e/mockApi.ts`), which is `undefined` (the global `fetch`)
  in every other build. App logic, the rate limiter, the cache, retries and
  error mapping all run as usual.
- **The fixtures go only into the E2E APK.** `npm run e2eapi:gen` writes them,
  with the test covers, to `src/generated/e2eApiFixtures.json` (loaded and
  validated by the web suite's own `loadMockIndex`; `npm run check` fails when
  it is out of date). `metro.config.js` resolves that file to an empty module
  unless `EXPO_PUBLIC_E2E_MOCK_API=1`, which only `scripts/build-android-apk.sh
  e2e` and the `e2e` EAS profile set. Proof on the September 2026 builds:
  the production APK's `index.android.bundle` is 5,236,736 bytes against the
  E2E one's 5,564,832, and `grep -a -c myshelf-e2e-api-fixtures-v1` (the
  bundle's marker) and a recorded work key (`OL453657W`) find nothing in it.
- **Unrecorded requests fail loudly**, like the web `network/unmocked` rule:
  the request fails (the app sees no network) and the app logs
  `[e2e-mock-api] unmocked <url>`. `scripts/maestro-suite.sh` keeps the app's
  JavaScript log in `maestro-results/app-js.log` and fails the
  `mock-api-unmocked` check listing every such URL
  (`unmocked-requests.txt`). Record them with `scripts/record-fixture.mjs`
  (Open Library) or add a synthetic Google Books entry to the index, then
  `npm run e2eapi:gen` and rebuild.
- **The switch is per flow**, from the fixture link: `api=mock` (the default)
  or `api=live`, and `network=online` (default) or `network=offline`, which
  fails every request as a phone without a connection does, without touching
  the radio. `common/open-fixture.yaml` takes them as `API` and `NETWORK`;
  `myshelf://e2e/network?state=online&next=/` switches the network back
  without reloading. The switch is kept in the app's files (`e2e-api.json`),
  so it survives a cold start and `clearState` resets it.
- **Covers shown by `expo-image`** (the fixture books' `covers.openlibrary.org`
  URLs) are loaded by Android's image loader, not the HTTP client, so they
  still come from the internet when there is one. No flow depends on them: in
  airplane mode they fall back to the drawn covers and every flow passes.

| Flows | Services |
|---|---|
| every flow in `.maestro/` except those below, the `cover-scan/photo-*` flows and the hooks | recorded responses (the offline pair with the simulated network off, then on) |
| `lookup-isbn-online.yaml` and the script's `lookup-cover-stored` check | **live**: the real Open Library and Google Books over the phone's network stack, to prove that path; the lookup is sent again up to three times when it cannot reach the catalogues, and the suite runs the flow up to three times, after waiting for the network |

`scripts/maestro-suite.sh --offline` runs everything but the live steps in
airplane mode, to prove the rest never needs the network.

## Running the Maestro suite locally

Once: install [Maestro](https://maestro.mobile.dev) 2.10 or later
(`curl -fsSL https://get.maestro.mobile.dev | bash`) and create an emulator,
for example a Pixel 7 on Android 16 with a **Google APIs** image (not
"Google Play": `adb root` must work for the reminder and cover checks):

```bash
sdkmanager "system-images;android-36;google_apis;arm64-v8a"      # x86_64 on an Intel Mac or Linux
avdmanager create avd -n myshelf-test -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_7
emulator -avd myshelf-test -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -port 5554 &
```

Then build and run:

```bash
scripts/build-android-apk.sh e2e
scripts/build-android-apk.sh production
scripts/maestro-suite.sh --e2e-apk build/myshelf-e2e.apk \
  --production-apk build/myshelf-production.apk --device emulator-5554
```

The run takes 35 minutes on an idle Mac, longer on a busy one. Results go to
`maestro-results/` (one folder per step with Maestro's screenshots and logs,
and a JUnit report per step); the script prints a summary and exits 1 if
anything failed. Look at the screenshots, not only the pass/fail.

`scripts/maestro-suite.sh` does what a plain `maestro test .maestro/`
cannot:

- installs the E2E APK and puts the phone in a known state (light mode, 100 %
  text, online or, with `--offline`, in airplane mode, automatic time), and
  pushes the test backup and the Goodreads export to Downloads for the
  document picker;
- runs the flows that need the phone changed around them: dark mode
  (`cmd uimode night yes`), 200 % text (`settings put system font_scale 2.0`),
  the offline queue (the app's simulated network off, then on for
  `hooks/offline-resume.yaml`);
- runs the `live` flow with up to three attempts, each after checking the
  phone can reach `openlibrary.org:443`, and then checks the app's database
  holds the cover as a `file://` path and the file exists (waiting up to a
  minute for the download);
- fails the `mock-api-unmocked` check if any request had no recorded
  response;
- after turning on reminders, checks Android's alarm list has the reminder,
  kills the app, moves the clock to the loan's due date, waits for the
  notification and taps it (`hooks/reminder-open.yaml`), which must open the
  book;
- runs `.maestro/cover-scan/photo-*.yaml` for each of the developer's cover
  photos present in `.maestro/cover-scan/photos/` (never committed);
- installs the production APK for the `production` flows, then puts the E2E
  APK back;
- puts the phone's settings back however the run ends.

One flow: `maestro --device emulator-5554 test .maestro/loan-lend-return.yaml`.
Give Maestro one file or one folder: with several file arguments it cannot
find a flow's `addMedia` files. Writing flows: [`.maestro/README.md`](../.maestro/README.md).

## In CI

`.github/workflows/android-e2e.yml` (Actions → **Android E2E** → Run
workflow, or `gh workflow run android-e2e.yml --ref <branch>`; also every
Monday on `main`) builds both APKs for x86_64, boots a Pixel emulator on
Android 15 (Google APIs, KVM) with `reactivecircus/android-emulator-runner`,
runs `scripts/maestro-suite.sh` and uploads `maestro-results/` as an artifact.
Only the `live` steps use the real Open Library and Google Books (and so
need the runner's network); they retry, as above. The optional
`GOOGLE_BOOKS_API_KEY` secret is built in when set. The developer's cover
photos are not there, so those three flows are skipped; the committed
made-up cover still exercises on-device text recognition.

What the first runs taught about the CI emulator (x86_64 on KVM with
software rendering, `-gpu swiftshader_indirect`; noticeably slower to start
the app than an arm64 emulator on an Apple-silicon Mac):

- **Start-up is slow enough to reorder events.** Launching the fixture link,
  the app's JavaScript starts before Android has resumed the activity, and
  the first render keeps the JS thread busy for a second or more, so the
  start-up timer and Android's resume can arrive *after* the fixture loader
  has finished and gone to the Shelf. Booky's start-up checks used to look
  only at the route at that moment, so the demo fixture's overdue loan got a
  nudge over the list, and the flows' first tap on a book landed on the tip
  (run 36317139740: book detail, process death, dark mode). The loader now
  marks the visit (`src/features/e2e/fixtureVisit.ts`) and the checks stay
  quiet until the app has been in the background. Reproduced locally on an
  Android 15 arm64 emulator started with `-cores 1`.
- **Metro's cache survives between the two builds when `CI` is set.** Expo
  skips React Native's usual cache reset on CI, and `EXPO_PUBLIC_*` values are
  written into the code as it is transformed, so the production APK (built
  second) reused the E2E build's modules: the fixture loader was on and a
  fresh install skipped the onboarding (the first-run flow failed on
  "Welcome to MyShelf"). `metro.config.js` now keys the cache on a hash of the
  public values. Reproduce with `CI=true scripts/build-android-apk.sh` for one
  kind and then the other.
- **It catches what Jest cannot.** The first run on the merged fixes of
  late September found two regressions only a real device shows: "Use this
  photo" deleted the camera's photo before the text reader opened it (every
  camera cover read failed), and closing the in-memory database a restore
  uses to bring an older backup up to date aborted the app natively
  (expo-sqlite finalizing statements SQLite's search index keeps for itself;
  it is now opened with `finalizeUnusedStatementsBeforeClosing: false`).
- An action snackbar lasts 6 s. On a much slower emulator (one core), the
  steps between an Undo appearing and the tap on it can take longer than
  that, and the tap then lands on the Add book button, which drops back into
  the snackbar's place. The CI emulator is fast enough; keep flows from
  putting slow steps between a snackbar and its action.

## The flows

| Flow | What it proves on the phone |
|---|---|
| `launch.yaml` | cold start with a cleared app: onboarding skipped, every tab by tap, Android back from the Shelf leaves the app |
| `onboarding.yaml` | first-run fixture: the four onboarding pages, then a relaunch goes straight to the Shelf |
| `first-run-production.yaml` | **production APK**: a fresh install shows the onboarding, Skip lands on an empty Shelf, a relaunch does not show it again, and the E2E link is a "Page not found" that leaves the library alone |
| `book-add-manual.yaml` | add a book with the Android keyboard (title, author chip, genre chip, year, four stars), save, see it on the Shelf |
| `lookup-isbn-online.yaml` (**live**) | a real ISBN lookup (Open Library and Google Books over the phone's network stack with the app's User-Agent), choose, save; the cover is downloaded into the app's storage (`file://…/covers/1.jpg`, checked in the database) |
| `scan-inject-isbn.yaml` | a barcode read injected by the E2E link → lookup (recorded) → edition picker → saved book |
| `book-detail.yaml` | rate five stars, edit the year (call number follows), delete from the menu with the confirmation, Undo from the Shelf's snackbar |
| `loan-lend-return.yaml` | lend to a new borrower with **Android's date picker** (next month, the 15th), the stamp, the Loans tab's order, Mark returned, History |
| `series-detail.yaml` | Discworld's spine shelf with the dashed gap, "Add #3" opens the form with the series and number filled in |
| `groups-multiselect.yaml` | a new group (icon, colour), long-press starts selection and Android back ends it, select three books, add them to the group |
| `sort-filter.yaml` | the Sort sheet's Library order preset and its levels, then the On loan filter |
| `backup-restore.yaml` | the backup opens **Android's share sheet** with the dated file; a backup in Downloads is picked with the **system document picker** and replaces the library |
| `csv-import-goodreads.yaml` | a Goodreads export picked in the document picker: mapping, preview, 20 books imported, groups made, covers arriving |
| `scan-permission.yaml` | the camera refused twice → "The camera is switched off" with Open settings (which opens MyShelf's page in the phone's settings); allowed → the barcode camera with its torch, cover mode's camera, and back |
| `cover-scan-camera.yaml` | cover mode with the camera refused (the photo picker still offered) and allowed: a photo of the virtual scene is taken, checked and read without crashing |
| `cover-scan-synthetic.yaml` | a made-up cover in the gallery → **ML Kit** reads it on the phone → the edition picker offers "The Colour of Magic" → saved |
| `cover-scan/photo-*.yaml` | the same with photos of three real covers (only where the photos are) |
| `book-form-back-guard.yaml` | Android back on a clean form just closes it; on a changed one it asks, Keep editing stays, back closes the dialog not the form, Discard leaves |
| `process-death.yaml` | turning the phone leaves the portrait layout alone; after Android kills the app in the background it starts again with the library intact |
| `error-boundary.yaml` | a screen that crashes shows Booky's error page; Copy error details opens the share sheet; the tab bar still works and the tab recovers |
| `loan-swipe-return.yaml` | a vertical swipe over the loan cards scrolls; a loan card swiped to the left (gesture handler, inside the screen's scroll view) opens the return sheet, and confirming brings Dune home and into History |
| `group-drag-reorder.yaml` (+ hook) | Reorder mode in Holiday reads; the script holds "Pride and Prejudice" and drags it to the top with `input draganddrop` (Maestro cannot hold and drag), then `hooks/group-drag-check.yaml` sees the rows renumbered, "Pride and Prejudice moved to 1 of 3" announced and the order kept after the app restarts |
| `db-export.yaml` (+ `db-export-setup.yaml`) | with `adb root`, the script leaves the E2E fault marker `files/e2e-db-fault` (`migrate`) after loading `demo`: the app starts on "I couldn't open your library", "Save a copy of the library file" opens the share sheet with `myshelf-library-<date>.db`, Try again opens the library, and the script checks the shared copy is a SQLite file with the 12 books |
| `reminders.yaml` (+ hook) | the switch asks for Android's notification permission and stays on after a restart; the reminder is in the alarm list; on the due date the notification "“Dune” is due back today" is posted with the app killed, and tapping it opens Dune |
| `dark-mode.yaml` | with the phone in dark mode: the Shelf, a book, the lend sheet, the date picker, Loans, Settings and the spines, for review |
| `font-scale.yaml` | at Android's 200 % text: the Shelf in all three views, a book, the edit form, Loans, Groups, Settings and Scan, for review |
| `shelf-spines-scroll.yaml` | the `large` fixture (2,000 books): the covers grid and the spines scroll with no "app not responding", and the view mode survives a restart |
| `offline-queue.yaml` (+ hook) | with the simulated network off the lookup says it cannot reach the catalogues, a scanned ISBN is queued with the Shelf's banner; back on, reopening the app finds the details and the banner goes |

## Regression checklist (P09-10)

Run before each release on the release candidate's APKs, and note the result
in the release pull request.

- [ ] `scripts/maestro-suite.sh` green on an emulator (or the Android E2E
      workflow green), with the screenshots looked at.
- [ ] The same on a physical phone, ideally one Pixel and one Samsung.
- [ ] Barcode scanning with the real camera: a few books, including one
      whose barcode is small or curved, with the torch and in low light.
- [ ] Cover reading with the real camera on two or three real books.
- [ ] The TalkBack walkthrough in [`accessibility.md`](accessibility.md#talkback-walkthrough-to-run-on-the-phone).
- [ ] Offline: airplane mode on, scan two books, airplane mode off, open the
      app, details arrive.
- [ ] Upgrade: install the previous release, add a few books, lend one,
      install the new APK over it; everything is still there.
- [ ] The production APK: fresh install shows the onboarding; the E2E link
      `myshelf://e2e?fixture=demo&next=/` shows "Page not found".
- [ ] A loan reminder arrives on the day (set a loan due tomorrow, or move
      the phone's date) and opens the book.

## Results: September 2026

On `native-verify` rebased on `main` at `1e73836` (with on-device cover
reading and the lookup accuracy fixes): the E2E and production APKs, R8
shrunk, built with `scripts/build-android-apk.sh` for arm64-v8a, on the
emulator `myshelf-test`: Pixel 7 profile, Android 16 (API 36), Google APIs
arm64 image, 1080 × 2400, on an Apple-silicon Mac.

All passed in the final run (`scripts/maestro-suite.sh`) on the final build,
and in the runs before it on each earlier build. Screenshots of every flow
were looked at.

| Step | Flows and checks | Result |
|---|---|---|
| plain flows | `launch`, `onboarding`, `book-add-manual`, `scan-inject-isbn`, `book-detail`, `loan-lend-return`, `series-detail`, `groups-multiselect`, `sort-filter`, `backup-restore`, `csv-import-goodreads`, `scan-permission`, `cover-scan-camera`, `cover-scan-synthetic`, `book-form-back-guard`, `process-death`, `error-boundary`, `shelf-spines-scroll` | 18 / 18 passed |
| `cover-scan/photo-*.yaml` | three real covers | skipped: the photos are not on this machine (they passed on the developer's, P03-05) |
| `lookup-isbn-online` | the flow, then the database: 1 book with a `file://` cover, 1 file in `covers/` | passed |
| `reminders` | the flow; the alarm is set; with the app killed and the clock on the due date the reminder is posted; `hooks/reminder-open.yaml` opens Dune from the shade | passed |
| `dark-mode` | at `cmd uimode night yes` | passed |
| `font-scale` | at `font_scale 2.0` | passed |
| `offline-queue` | in airplane mode; then `hooks/offline-resume.yaml` online | passed |
| `first-run-production` | on the production APK | passed |

Also by hand: installing the new E2E APK over the build from `main` before
this work, with the demo library and its loans, kept all 12 books and the
open loans; the app launched without the onboarding.

### With recorded API responses

On the `hermetic` branch (from `main` at `1f8f688`), arm64-v8a APKs on the
emulator `myshelf-ocr` (Android 16, Google APIs arm64):

| Run | Result |
|---|---|
| discovery run, before the missing fixtures were recorded | every step passed except `cover-scan-synthetic`; `mock-api-unmocked` listed the three searches it and the Goodreads import made, which were then recorded |
| full suite, twice, on the final APKs | every step passed, `mock-api-unmocked` included; the live lookup passed on its first attempt both times |
| `--offline` (airplane mode, live steps skipped) | every step passed; the demo covers showed their drawn stand-ins, as nothing could load them |
| Android E2E workflow, run 36359434237 | every step passed |

### Bugs found on the device and fixed

| # | Symptom on the phone | Cause | Fix |
|---|---|---|---|
| 1 | The add form's **Save to shelf** button read "Save to": the last word was cut off. It happened on a cold start straight into the form, and every second time the form was opened. | Two causes. React Native sizes a Text from a `StaticLayout` built without `useBoundsForWidth`, but from Android 15 a `TextView` in an app targeting SDK 35+ draws with it on, so a glyph reaching past its advance (the "f" of "shelf") needs a few pixels more than measured, and the last word wraps onto a line the view has no room for. And on a cold start `@expo/vector-icons` loaded the icon font after the first layout. | `fb4557a`: `plugins/withAndroidTextBounds.js` gives every `TextView` a default style with `useBoundsForWidth` off, so drawing matches measuring (tested in `plugins/__tests__/withAndroidTextBounds.test.js`); `6979362`: the root layout waits for the icon font with the text fonts (`src/theme/fonts.ts`, `fonts.test.ts`). |
| 2 | The dashed gap on a series shelf read "#3 missin / g": Android broke the word mid-way. | "missing" was written across the 44 dp spine, where it does not fit; the web build let it overflow. | `713e4c7`: it runs up the gap like a spine title, the number on a label at the foot (`Spine.tsx`); Jest test in `Spine.test.tsx`. |
| 3 | A generated cover (a book without a picture) read "J. R. R." for J. R. R. Tolkien, the rest of the name gone; in the narrow covers grid a long name was split at any letter ("Fairwe / ather"). | The lettering was sized to its own measured width, and Android wrapped it when drawing (the same measure/draw difference as #1: the serif "J" reaches past its advance), clipping the second line. Long words have nowhere to break in a narrow cell. | `ac4f33c`: the lettering spans the cover's width, and Android may hyphenate (a name it cannot hyphenate ends in "…" instead); Jest test `GeneratedCover.test.tsx`. |
| 4 | Android's date picker (lend and return) was **teal**, as were the text cursor and selection handles in every field. | The generated Android theme had AppCompat's default accent. | `c159460`: `plugins/withAndroidAccent.js` sets `colorAccent` to the theme's primary (night primary in dark mode); `primaryColor` in `app.json`; tested in `plugins/__tests__/withAndroidAccent.test.js`. |
| 5 | The loan reminder showed a **blank circle** as its icon in the status bar and the shade. | No notification icon was configured, and Android draws only the alpha of the app icon. | `c27892e`: `assets/notification-icon.png`, rendered from the monochrome Booky (`npm run icons:render`), and the app's purple, through the `expo-notifications` plugin. |

Checked and found to work, with no change needed: the native network stack
and User-Agent (both catalogues answered; Google Books' keyless quota was
exhausted at the time, which the app reports and falls back from), cover
downloads into app storage, FTS5 search tables on Android's SQLite, the
share sheet, the document picker, the camera permission and settings link,
the camera preview in both modes, on-device text recognition, notification
permission, scheduling, delivery with the app killed, re-arming after a
force stop, and opening the book from the notification, Android back
everywhere it was tried, process death, portrait lock, dark mode (status bar
icons, sheets, the date picker), 200 % text, airplane mode and recovery, and
that the production build's E2E links are inert.

Seen and left as they are (not bugs, or not for this card): at 200 % text the
Shelf's search placeholder is cut ("…author or ISB") as single-line fields
cut placeholders; the Add book button covers the corner of the row beneath it
until the list scrolls, as a floating button does; the reminder alarm is
inexact, so it can arrive up to an hour after 10:00. (Before `main`'s
accuracy fixes, the made-up cover's first edition was a French one; with
them it is Corgi's English paperback, with its real cover.)

### TalkBack-adjacent checks

TalkBack's speech cannot be checked on an emulator, but what it reads can:
the accessibility tree Android builds from the app (`uiautomator dump`),
which is what TalkBack walks. On ten screens with the demo library (the
Shelf, a book, the add form, Loans, a borrower, Groups, Series, Scan,
Settings and Restore), every clickable, checkable or long-clickable element
had a name, its own or its children's: none unnamed out of 113. Roles and
states come through as Android widgets: Booky's Helpful / Quiet / Off are
`RadioButton`s with `checked`, the settings switches are `Switch`es with
`checked`, the selected tab is `selected`, book rows carry the whole line
("Dune, by Frank Herbert, 1965, rated 4 out of 5, on loan to Sam"), and the
star rating is one control ("Rating, Not rated") with its stars hidden from
TalkBack. The Maestro flows find controls by these names too (the date
picker's calendar button is "Choose due back from a calendar").

### Not verified on an emulator

- The real camera on real books: barcode reading (focus, glare, curved
  barcodes, the torch, the haptic tick) and cover photos under real light.
  The emulator's camera is a virtual scene; barcodes were injected and the
  cover was a picture in the gallery.
- TalkBack's speech: what it actually says, in what order, and whether a
  live region interrupts. The labels, roles and states it reads are checked
  above; the walkthrough in [`accessibility.md`](accessibility.md) is for a
  person with a phone.
- OEM differences: Samsung One UI's font sizes and "display size", its
  battery optimisation (which can delay or drop a scheduled reminder), and
  other vendors' share sheets and pickers.
- Upgrading from a previous release: there is none yet. Installing the
  rebased build over the one from `main` kept the library, but both use the
  same database schema, so no migration ran.
- Performance on a mid-range phone (the emulator runs on a fast Mac).
