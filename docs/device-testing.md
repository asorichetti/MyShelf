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
| E2E | `scripts/build-android-apk.sh e2e` | `build/myshelf-e2e.apk` | Maestro. The fixture loader is in (`EXPO_PUBLIC_E2E=1`, [ADR 0015](adr/0015-e2e-fixture-loader-per-platform.md)): `myshelf://e2e?fixture=<name>&next=<route>` wipes the library and loads a fixture, `myshelf://e2e/scan?isbn=<isbn>` injects a barcode read. Never give it to anyone. |
| Production | `scripts/build-android-apk.sh production` | `build/myshelf-production.apk` | What users install (`EXPO_PUBLIC_E2E=0`): the E2E links are a "Page not found" and touch nothing. The first-run flow runs on it. |

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
  text, online, automatic time), and pushes the test backup and the Goodreads
  export to Downloads for the document picker;
- runs the flows that need the phone changed around them: dark mode
  (`cmd uimode night yes`), 200 % text (`settings put system font_scale 2.0`),
  airplane mode (then back online for `hooks/offline-resume.yaml`);
- after the online lookup, checks the app's database holds the cover as a
  `file://` path and the file exists;
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
The lookup flows use the real Open Library and Google Books, so a run can
fail when either is down or rate-limits the runner; the optional
`GOOGLE_BOOKS_API_KEY` secret is built in when set. The developer's cover
photos are not there, so those three flows are skipped; the committed
made-up cover still exercises on-device text recognition.

## The flows

| Flow | What it proves on the phone |
|---|---|
| `launch.yaml` | cold start with a cleared app: onboarding skipped, every tab by tap, Android back from the Shelf leaves the app |
| `onboarding.yaml` | first-run fixture: the four onboarding pages, then a relaunch goes straight to the Shelf |
| `first-run-production.yaml` | **production APK**: a fresh install shows the onboarding, Skip lands on an empty Shelf, a relaunch does not show it again, and the E2E link is a "Page not found" that leaves the library alone |
| `book-add-manual.yaml` | add a book with the Android keyboard (title, author chip, genre chip, year, four stars), save, see it on the Shelf |
| `lookup-isbn-online.yaml` | a real ISBN lookup (Open Library and Google Books over the phone's network stack with the app's User-Agent), choose, save; the cover is downloaded into the app's storage (`file://…/covers/1.jpg`, checked in the database) |
| `scan-inject-isbn.yaml` | a barcode read injected by the E2E link → real lookup → edition picker → saved book |
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
| `reminders.yaml` (+ hook) | the switch asks for Android's notification permission and stays on after a restart; the reminder is in the alarm list; on the due date the notification "“Dune” is due back today" is posted with the app killed, and tapping it opens Dune |
| `dark-mode.yaml` | with the phone in dark mode: the Shelf, a book, the lend sheet, the date picker, Loans, Settings and the spines, for review |
| `font-scale.yaml` | at Android's 200 % text: the Shelf in all three views, a book, the edit form, Loans, Groups, Settings and Scan, for review |
| `shelf-spines-scroll.yaml` | the `large` fixture (2,000 books): the covers grid and the spines scroll with no "app not responding", and the view mode survives a restart |
| `offline-queue.yaml` (+ hook) | in airplane mode the lookup says it cannot reach the catalogues, a scanned ISBN is queued with the Shelf's banner; back online, reopening the app finds the details and the banner goes |

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
