# Phase 09 — Polish, accessibility and release

## Goal

Ship v1.0: an accessible, fast, robust app with a dark theme, a free and repeatable release pipeline producing a signed APK/AAB on GitHub Releases, store-ready assets and a privacy policy, verified end to end on real Google and Samsung devices.

## Scope

- Accessibility audit and fixes (TalkBack, font scaling, contrast, targets).
- Dark theme.
- Performance and full-text search.
- Error boundaries and resilience.
- Icon/splash with Booky; screenshots; README media.
- Release configuration, CI release workflow, privacy policy, final device regression.

## Out of scope

- iOS release. Play Store publishing (optional, requires the one-time developer fee — see [ADR 0011](../adr/0011-free-android-release-pipeline.md)).

## Prerequisites

- Phases 00–08 complete.

---

## Task cards

### P09-01 Accessibility audit and fixes

- **Description:** Walk every screen with TalkBack on a device and with the auto test suite's `a11y` gate on web. Check: every control has a role and name; headings mark sections; focus order logical; state changes announced; 48 dp targets; layouts at 200 % font scale and display size "Largest"; no information by colour alone. File and fix issues; record the audit in `docs/accessibility.md`.
- **Files:** components/screens as needed; `docs/accessibility.md`.
- **Acceptance:** every journey passes with `--ux-gates fail` and no new `a11y` waivers or disabled rules (including the P00-27 `target-size` rule); TalkBack walkthrough of the core flows (scan → save, lend → return, group) succeeds without sighted help.
- **Tests:** new journey `a11y-large-text` (web zoom 200 %); component tests for any fixed labels.
- **Partly delivered:** the audit is recorded in [`docs/accessibility.md`](../accessibility.md): every screen and 24 interactive states walked on the web build with the gates, axe-core (both themes), a scripted Tab walk, Enter and Space on every role, and 200 % text; 23 issues found and fixed, none waived. Keyboard (web): Enter now opens links drawn as `div`s (Settings, series, author, genre and borrower rows) and Space operates checkboxes, radios, switches, tabs and menu items (`useKeyboardActivation`); react-native-web's Modal wrapper is named after its sheet, dialog or menu; focus returns to the opener when a modal closes, also when its first field took focus or its opener has gone (`useReturnFocus`, the help sheet's `returnFocusTo`); the scrim is never focusable (`Scrim`); menus take the arrow keys, Home and End; select lists open on their current choice. Announcements: the snackbar host is one always-present polite live region; the CSV import announces its progress, and its report and a finished restore take focus; lending and returning move focus to the button that replaces the one pressed. Names: lists hold only list items (author index, lookup results, pickers); an edition says whether it has a cover picture; the web date field follows the theme. Large text: the theme carries a font scale (`useFontScale`; the system's on a phone, `?e2e-font-scale` on the web E2E build, which scales the typography tokens since react-native-web writes px); clamps grow with it; tab labels stop at 150 % and the bar grows; picture lettering keeps its size (`artworkTypography`); buttons, chips, stamps, the form bar, the book header and facts, and series rows wrap instead of overflowing or breaking words. Journeys (p09): `a11y-large-text`, `a11y-keyboard-sheets`, `a11y-keyboard-menu-dialog`, `a11y-keyboard-tabs`, `a11y-keyboard-lend-return`, `a11y-help-focus`. **Not done:** the TalkBack walkthrough on a device (the checklist is in `docs/accessibility.md`), so the Android side of the live region, focus and font-scale fixes is verified only through their props in Jest; Android's display size "Largest" not tried. *Update (P09-10):* on an Android 16 emulator, 200 % text was checked on every tab, a book, the edit form and the three Shelf views (`.maestro/font-scale.yaml`, screenshots reviewed), and the accessibility tree of ten screens has no unnamed control, with radio buttons, switches and the selected tab exposed as such ([`docs/device-testing.md`](../device-testing.md)). The TalkBack walkthrough and display size remain.

### P09-02 Dark theme — done

- **Description:** Dark token set from `PLAN.md` §9; follow system by default with a Settings override (System / Light / Dark); `app.json` `userInterfaceStyle` → `automatic`; Booky and motifs (catalogue cards become "night reading" cards) adapted; CSS vars switch on web via `prefers-color-scheme` and a data attribute.
- **Files:** `src/theme/tokens.ts` (`darkColors`), `src/theme/themes.ts` (`darkTheme` in `themes`), `src/theme/ThemeProvider.tsx`, `src/features/settings/PreferencesScreen.tsx`, `app.json`, SVG components.
- **Acceptance:** all text pairs ≥ 4.5:1 in dark (unit test); every screen screenshot reviewed in both themes.
- **Tests:** `src/theme/__tests__/contrast.dark.test.ts`; journey `theme-dark-gallery`.
- **Delivered:** the "night library" (`darkColors`, `darkTheme`; values in `PLAN.md` §9): warm aubergine paper and card stock rather than black, parchment ink, lamp-lit lavender primary and berry accent, deep container fills, black shadows (`darkElevation`), generated-cover cloths one step brighter so they stand out on dark cards (`darkCoverPalette`, same order, so a book keeps its hue), deep group swatches instead of glaring pastels (`darkGroupSwatches`, `groupSwatch(name, scheme)`), and Booky with a brighter body and a moonlit edge. Catalogue cards keep their berry rule and faint ruled lines on night card stock; real covers sit on the dark `surface`, so a padded scan has no white frame around it. `contrast.dark.test.ts` holds every `textPairs` pair to 4.5:1 and every `uiPairs` pair to 3:1, plus the covers, the swatches and "dark but not black". `ThemeProvider` resolves a preference (System, Light, Dark) against `useColorScheme()` and follows the system as it changes; the setting `appearance` (default `system`) is chosen under **Appearance** on Settings → Shelf and lending (radio cards, `themeSetting.*` test ids) and applied app-wide by `SettingsWatchers` (an unknown stored value means System). On web the `--ms-*` variables, `data-theme` and `color-scheme` on `:root` switch with the theme, and `public/index.html` has dark fallbacks for the moment before the bundle runs. The status bar icons follow the theme. `app.json` `userInterfaceStyle` is now `automatic` (the one line this card needed there). Journeys (p09): `theme-dark-follows-system`, `theme-dark-gallery`, `theme-setting-persist`; `theme-tokens` now pins the light scheme. Dark screenshots reviewed: the Shelf (list), a Booky tip, book detail, the edit form, Loans, Groups, Settings, Shelf and lending and the empty Shelf with Booky, plus the `screenshot --schemes light,dark` matrix (mobile) for the Shelf, book detail, the edit form, Loans, Groups, Settings and Shelf and lending. **Not verified:** on an Android device (the system switch, the status bar, native date pickers, which keep the system's scheme when the app overrides it); screens outside that list were not reviewed one by one in dark, though they use the same role colours and pass the gates in the full journey run. With the preference stored in the database, a phone set to the other scheme shows the system's theme for the moment before the database opens.

### P09-03 Performance and full-text search — done

- **Description:** Profile with the `large` fixture (2,000 books) and a generated 10,000-book fixture: startup to interactive < 2 s on a mid-range device, shelf scroll without dropped frames, search < 100 ms. Add migration `0006_book_search` (0004 and 0005 were taken by then) with an FTS5 virtual table over title, subtitle, authors, series, ISBN, kept in sync by triggers; switch search to FTS with a `LIKE` fallback if FTS5 is unavailable. Tune list props (`getItemLayout`, `windowSize`), memoisation, image sizes.
- **Files:** `src/db/migrations/0006_book_search.ts`, `src/db/repositories/books.ts`, list components, `src/testing/fixtures/huge.ts`.
- **Acceptance:** targets met and recorded in the PR with measurements; FTS results identical to `LIKE` results on test cases.
- **Tests:** `src/db/repositories/__tests__/books.fts.test.ts`; journey `shelf-large-scroll` (timing recorded in evidence).
- **Delivered:** migration `0006_book_search`: the view `book_search_source` (title, subtitle, authors, series, genres, notes, ISBN-13 and -10 per book) and triggers on `books`, `book_authors`, `authors`, `book_genres`, `genres` and `series` keep one search row per book current, so every write path (form, lookups, imports, restores, merges, erase) updates it. **FTS5 availability:** expo-sqlite on Android compiles FTS5 in (`SQLITE_ENABLE_FTS5` unless `enableFTS` is false; `app.json` does not turn it off), but the web build's wa-sqlite and Node's `node:sqlite` (Jest) are built without it. So the migration probes for FTS5 and creates either `books_fts` (FTS5, `unicode61 remove_diacritics 2`) or, without it, the plain table `books_search` (lower-cased text with common punctuation as spaces, plus an all-ASCII flag). `searchClause` in `repositories/books.ts` is the one API over both: every word must match the start of a word in any field ("prat" finds Pratchett, "cien anos" finds "Cien años", "marquez soledad" works across fields); a digit-ish query is one ISBN word and also matches the ISBN columns anywhere; a database from before 0006 falls back to the old `LIKE`. The plain index uses `instr` on all-ASCII rows and an accent-folding `GLOB` pattern elsewhere; the two agree on the test cases (`books.fts.test.ts` runs every case on both, the FTS5 side on better-sqlite3, a new dev dependency, since Node's SQLite lacks FTS5) except for letters that fold to two ("ß"), which neither expands. Filters, scope and sorting are unchanged: search is one more `WHERE` condition. Performance: fixture `huge` (10,000 generated books, notes on every seventh); the Shelf records each query as a User Timing measure (`myshelf:shelf-query`); the list query takes the open loan from one join instead of three subqueries, computes the author sort key only when sorting by author and reads all author links in one query for long lists; the web database gets a 16 MB page cache (`pragmas.web.ts`). List props were already tuned (`initialNumToRender`, `windowSize`, memoised rows) and the scroll showed no dropped frames, so they were left alone. **Measured** (web export, headless Chromium on the development Mac, `shelf-huge-search` / `shelf-large-scroll`; before = `main` at e13d6b8 with the new fixture and journeys): huge, median search query 10.7 → 5.4 ms (max 13.9 → 8.7), typed-to-shown less the 200 ms debounce 34 → 29 ms; clearing the search (all 10,000 books) 62 → 33 ms; cold reload's first Shelf query 183 → 92 ms, first row on screen 334 → 230 ms; large, first query 44 → 30 ms. Fling to the end: 0 dropped frames before and after (huge 2,086 frames, p95 17 ms, 1 frame without a row on screen; large 441 frames, none). In Node on the huge fixture, the match alone takes 4–5 ms with the old `LIKE`, 1.4–2.2 ms with the plain index and 0.2–0.6 ms with FTS5 (better-sqlite3, standing in for Android's SQLite). The triggers make loading 10,000 books in Jest take about 3.5 s instead of 0.9 s; on web the fixture load is dominated by the bridge (about 47 s either way). **Not verified:** on an Android device (FTS5 at run time, start-up to interactive under 2 s, scrolling); the numbers above are the web build's.

### P09-04 Error boundaries and resilience

- **Description:** Root and per-screen error boundaries rendering `page-error` with Booky (*concerned*), "Try again" and "Copy error details" (local only, no reporting service). Handle DB open/migration failure with a recovery screen offering export of the raw DB file (today `DatabaseErrorScreen` offers only a retry). Guard every async action against unmount.
- **Files:** `src/components/ui/ErrorBoundary.tsx`, `src/app/_layout.tsx`, `src/db/DatabaseProvider.tsx`, `src/features/navigation/DatabaseErrorScreen.tsx`.
- **Acceptance:** thrown render error in a screen shows the boundary, not a blank screen; migration failure screen reachable via a test hook.
- **Tests:** `src/components/ui/__tests__/ErrorBoundary.test.tsx`, `src/db/__tests__/DatabaseProvider.test.tsx` (failure cases).
- **Partly delivered:** `ErrorBoundary` (`src/components/ui/ErrorBoundary.tsx`) and a boundary per screen: the root stack and the tabs wrap every screen through the navigators' `screenLayout` (`src/features/navigation/ScreenErrorBoundary.tsx`), and `AppErrorBoundary` wraps everything below the database in `src/app/_layout.tsx`. A crash shows `ScreenErrorScreen`: `page-error`, concerned Booky, the h1 "Something went wrong here", Try again, Go to my shelf (on screens other than the Shelf) and Copy error details (the clipboard on web; the share sheet, which offers Copy, on a phone, since no clipboard module is bundled), with the error shown selectable; the details (`errorDetails.ts`: version, screen, time, stacks) never leave the phone unless the user sends them. A crashed tab starts afresh when revisited; the tab bar and other screens keep working. E2E-only hooks (inert without the E2E loader, ADR 0015): `/e2e?…&crash=<route>` arms a render error in that screen until its boundary has caught it (`src/features/e2e/crashSwitch.ts`), and on web `?e2e-db-fault=open|migrate` fails the first database open (`databaseFault.web.ts`), which reaches the existing `DatabaseErrorScreen` ("I couldn't open your library", Try again), verified in Jest (a database from a newer app) and in the journey. Corrupt rows: a loan whose dates are not dates counts as undated (`loanStatus` and the day counts), unreadable dates are shown as stored (`formatDate`, `formatShortDate`), Loans sorts due dates as text and reminders skip such loans; `src/__tests__/corruptData.test.tsx` fills the demo library with odd rows and nonsense settings and opens the Shelf, a book, Loans, a borrower, a group and Settings with no boundary shown and nothing logged. Missing covers were already handled (`CoverImage` falls back to the generated cover on a failed or 1×1 image). Journeys (p09): `error-boundary`, `db-open-failure`. **Not done:** the recovery screen's export of the raw database file (the screen still offers only Try again), and an audit of every async action for unmount guards (the new code guards its own; `DatabaseProvider` is tested for a failure after unmounting). **Not verified:** on a device. *Update (P09-10):* verified on an Android 16 emulator (`.maestro/error-boundary.yaml`): a crashing Loans tab shows the boundary, Copy error details opens the share sheet, the tab bar keeps working and the tab recovers. The raw database export remains.

### P09-05 App icon, splash and store graphics — done

- **Description:** Final adaptive icon (Booky on lavender, monochrome variant for themed icons), splash with Booky and the wordmark, feature graphic (1024×500) and screenshots. Assets exported from SVG sources kept in `assets/source/`.
- **Files:** `assets/*`, `assets/source/*.svg`, `app.json`.
- **Acceptance:** icon legible at 48 px, correct in themed-icon mode on Android 13+; splash has no flash of white.
- **Tests:** Maestro `launch.yaml` screenshot; manual review.
- **Delivered:** SVG sources in `assets/source/` copy Booky's artwork from `Booky.tsx` in the light theme's colours (`booky.svg` is the reference). `scripts/render-icons.mjs` (`npm run icons:render`) renders every PNG with Playwright's Chromium and the app's own fonts: `icon.png` (1024², full bleed), the adaptive icon's foreground (Booky inside the 66 dp safe circle), lavender background and monochrome layer (one solid Booky with the eyes and smile cut out, for Android 13+ themed icons), `splash-icon.png` (Booky over the Lora wordmark, inside the 192 dp circle Android 12+ keeps), `favicon.png` (48²), and the Play Store `assets/store/icon-512.png` and `assets/store/feature-graphic.png` (1024×500). `--preview <dir>` writes review sheets: circle, squircle and rounded-square masks at 192 and 48 px on light and dark wallpaper, the themed icon, the safe zone and the Android 12 splash; all were reviewed, as were the launcher icons and splash drawable `expo prebuild` generates from them. `app.json`: splash through the `expo-splash-screen` plugin (200 dp, paper `#FBF6EC`), and `backgroundColor` paper so the window behind the app is not white (prebuild writes it as `activityBackground`). **Not yet seen on a device:** the themed icon and the splash on Android 13+ (the release APK from P09-07 makes that possible; P09-10). Store screenshots are P09-08.

### P09-06 Release build configuration — done

- **Description:** `eas.json` `production` (AAB) and `preview` (APK) finalised; `app.json` `version` and `android.versionCode` strategy (versionCode from CI run number or EAS `autoIncrement`); Android permissions minimised (camera, notifications only; remove unused ones via `android.blockedPermissions`); local signed build documented (`npx expo prebuild -p android` then `./gradlew bundleRelease` / `assembleRelease` with keystore properties from environment variables — never committed).
- **Files:** `eas.json`, `app.json`, `docs/release.md`.
- **Acceptance:** a signed release APK installs on a clean device and passes the Maestro suite; manifest lists only the required permissions.
- **Tests:** Maestro suite on the release APK.
- **Delivered:** `plugins/withReleaseSigning.js` (tested in `plugins/__tests__/`) adds a `release` signing config to the generated `build.gradle`, reading `MYSHELF_UPLOAD_STORE_FILE`, `…_STORE_PASSWORD`, `…_KEY_ALIAS` and `…_KEY_PASSWORD` from Gradle properties or the environment, and falls back to the debug key without them. Versions come from the tag: `scripts/release-version.mjs` gives `versionCode = major×1,000,000 + minor×10,000 + patch×100 + (rc number or 99)` (`app.json` starts at `versionCode` 1); `eas.json` sets `cli.appVersionSource: local` and drops `autoIncrement`, so EAS, CI and local builds agree; `preview`/`production` set `EXPO_PUBLIC_E2E=0`. Permissions: `android.permissions` lists camera, internet, network state, vibrate, notifications and boot-completed; `android.blockedPermissions` removes storage reads, `READ_MEDIA_*`, media location, audio, overlay, Wi-Fi state, advertising id and C2DM push. `WRITE_EXTERNAL_STORAGE` (≤ Android 12, from `expo-image-picker`) stays: the camera picker asks for it on Android 9 and older. `android.allowBackup` is `false` (ADR 0012). `docs/release.md` covers local, EAS and CI builds, creating the upload keystore and storing it as secrets, versioning and the permission list. Checked with `npx expo prebuild -p android --clean` (manifest and `build.gradle` inspected). **Not yet done:** installing a signed release APK on a clean device and running Maestro on it, which needs the first CI build (P09-07) and a device (P09-10); the permissions merged in from libraries' AARs are listed by the CI run's summary, not checked yet.

### P09-07 CI release workflow

- **Description:** `.github/workflows/release.yml` on tags `v*`: run the regression gate; set up Java and Android SDK; `npx expo prebuild -p android --clean`; decode the keystore from repository secrets; `./gradlew assembleRelease bundleRelease`; attach APK and AAB plus SHA-256 checksums to a GitHub Release with notes from the tag message.
- **Files:** `.github/workflows/release.yml`, `docs/release.md`.
- **Acceptance:** pushing a test tag (`v0.9.0-rc1`) produces a draft release with both artifacts; secrets never printed.
- **Tests:** the workflow run itself.
- **Partly delivered:** `.github/workflows/release.yml`, on `v*` tags and `workflow_dispatch` (any branch; input `sign`, default on): the regression gate (as `ci.yml`: `npm run check`, the auto test suite's checks, smoke and every journey with gates set to fail), then Java 17 (Temurin), the NDK / build tools / platform named in React Native's version catalog, `scripts/release-version.mjs`, keystore from the `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` secrets (decoded into the runner's temp folder, removed afterwards) or a warning and a debug-signed build, `npx expo prebuild --platform android --clean`, `./gradlew assembleRelease bundleRelease` with Gradle caching (`gradle/actions/setup-gradle`). Artifacts `myshelf-<version>-<signed|debug-signed>.apk`, `.aab` and `.sha256`; the run summary shows checksums, the signing certificate and the APK's permissions. On a tag a draft GitHub Release (pre-release for `-rc` tags) gets the three files, with notes from `CHANGELOG.md` or the annotated tag message (`scripts/release-notes.mjs`). Passes `actionlint` (with shellcheck). **Not yet proven:** it has not run on GitHub; this card is done once a dispatched run and a test tag (`v0.9.0-rc1`) are green.

### P09-08 Screenshots and README media — done

- **Description:** Use `npm run -s autotest -- screenshot --viewports mobile --schemes light,dark --url '/e2e?fixture=demo&next=<route>'` (fixture loader from P01-01) for Shelf (each view mode), book detail, edition picker, Loans, Groups, series detail, Booky onboarding; plus device screenshots from Maestro for the camera screens. Save curated images in `docs/media/` and embed in `README.md`.
- **Files:** `docs/media/*`, `scripts/render-readme-hero.mjs`, `README.md`.
- **Acceptance:** README shows current UI; images < 300 KB each.
- **Tests:** none beyond the journeys used to capture.
- **Delivered:** the screenshots come from the Android app rather than the web build, so the README shows real book covers and the phone's own widgets: the E2E release APK (`scripts/build-android-apk.sh e2e`) on the Pixel 7 emulator (Android 16), online, with the `demo` fixture (`empty` for the lookups, `first-run` for onboarding) loaded through `myshelf://e2e?fixture=…`, driven by small Maestro flows and `adb input`, and captured with `adb exec-out screencap -p` once the covers had loaded, with System UI demo mode for a clean status bar (9:30, full battery, no notifications; switched off afterwards). Sixteen screens in `docs/media/`, 540 × 1200 WebP (14–76 KB each): the Shelf as a list, covers and spines (grouped by genre, in Library order), a book's page (cover and rating; its series card), a series with a gap, "Which edition is yours?" (from `myshelf://e2e/scan?text=THE COLOUR OF MAGIC`), a book just saved with Booky's "Shelved!" tip, the Sort sheet with three levels, the lend sheet with a due date, Loans with an overdue stamp, onboarding, Settings, and the Shelf and a book in dark mode. `add-by-isbn.gif` (286 KB, `adb shell screenrecord` then ffmpeg) adds a book from an injected ISBN against the live Open Library, its real cover arriving in the picker and on its page. `hero.webp` (205 KB) puts four of the screenshots in phone frames on a lavender wall with the wordmark and Booky, rendered by `scripts/render-readme-hero.mjs` (`npm run media:hero`: Playwright's Chromium and the app's fonts, as in `render-icons.mjs`, encoded by `cwebp`). The media total 1.1 MB, and no cover image is committed on its own: covers appear only inside app screenshots. The README is rewritten around them: badges (CI, licence, Android 7.0+ from the APK's `minSdkVersion` 24), the hero, the features as built, a screenshot gallery, installing (Releases or the Release workflow's artifacts, which APK, sideloading, debug-signed builds), building from source, the scripts (checked against `package.json`), the three test levels, live checks and CI, the project layout, privacy and licence. **Not captured:** the camera screens themselves (the emulator has no camera to point at a book, so the barcode read is injected) and the Groups tab.

### P09-09 Privacy policy — done

- **Description:** `docs/privacy.md`: no accounts, no analytics, no ads; data stays on the device; network requests to Open Library and Google Books contain only ISBNs/search text; camera images processed on device and discarded; notifications are local; how to export and erase data. Linked from About (P08-08) and the README.
- **Files:** `docs/privacy.md`.
- **Acceptance:** statements match the code (reviewed against `src/services`).
- **Tests:** none.
- **Delivered:** `docs/privacy.md`, checked against the code: the only hosts are `openlibrary.org`, `covers.openlibrary.org`, `www.googleapis.com` and `books.google.com` (every `fetch` goes through `src/services/http`; URLs from `src/services/metadata` and `src/services/covers`), carrying ISBNs, title/author search words, cover ids or Google volume ids and the `MyShelf/<version>` User-Agent; the cover backfill searches by ISBN (up to 40 in one Open Library batch search, e.g. after an import or restore) or by title and first author. It covers the build-time Google Books key, the Google Books and mobile-data switches, on-device barcode reading (with ML Kit's own data disclosure), cover photos (kept as covers; recognition photos deleted), the system photo picker, backups and exports (wherever the user saves them), opt-in local reminders (no push), each Android permission, and erasing data. The About screen's privacy link (`PRIVACY_URL`) and the README now point at it.

### P09-10 Final device regression — done

- **Description:** Release checklist in `docs/release.md`: full `maestro test .maestro/` (including `manual`-tagged flows) on a Google Pixel (or Pixel emulator) and a Samsung Galaxy device on the release APK; TalkBack pass; offline pass; fresh install and upgrade-from-previous-release (migrations) pass; E2E routes inert in the release build.
- **Files:** `docs/release.md`.
- **Acceptance:** checklist completed and linked in the release PR.
- **Tests:** the checklist.
- **Delivered:** the checklist and its first results are in [`docs/device-testing.md`](../device-testing.md) (linked from `docs/release.md`): 24 Maestro flows (plus two hooks the script runs between them, and three that read the developer's own cover photos), run by `scripts/maestro-suite.sh` on an Android 16 Pixel emulator against the E2E and production APKs, cover every core journey on the phone (onboarding, adding by hand and by an online lookup with a real cover, scanning by an injected barcode, reading a cover with ML Kit, detail, scrolling 2,000 books, lending with the native date picker, series, groups with multi-select, sort and filter, backup through the share sheet, restore and the Goodreads import through the document picker, the camera permission, the back-button guard, rotation and process death, reminders delivered on the due date and opened from the shade, dark mode, 200 % text, offline and back, the error boundary) and the production APK's first run with the E2E links inert. Five native-only bugs were found and fixed: "Save to shelf" drawn as "Save to" (Android 15+ draws text by glyph bounds where React Native measures by advances, fixed for every text view by a config plugin; and on a cold start the icon font arrived after the first layout), "missin / g" on a series gap, generated covers losing the author's second line ("J. R. R." for J. R. R. Tolkien) or splitting long names anywhere, a teal date picker and text cursor (no Android accent), and a blank notification icon. The release APKs are now per ABI and shrunk with R8: arm64-v8a is 60.7 MB to download and about 80 MB installed, where the universal APK was 190 MB and about 235 MB installed; the App Bundle stays universal for Google Play (`docs/release.md`). A label audit of ten screens' accessibility tree found no unnamed control. An install over the previous build kept the library. The whole suite also runs in CI (`android-e2e.yml`). **Not verified:** a physical Pixel or Samsung, the real camera on real books, TalkBack's speech, and upgrading from a previous release (there is none yet); these stay on the checklist for the release PR.

### P09-11 Localisation readiness — done

- **Description:** Move all user-facing strings (including Booky tips) into `src/i18n/en.ts` with a tiny `t()` helper; dates/numbers via `Intl`. English only for v1, but no hard-coded strings in components.
- **Files:** `src/i18n/*`, components.
- **Acceptance:** lint rule or test fails on string literals in JSX text outside `src/i18n` (with an allowlist for test ids and symbols).
- **Tests:** `src/i18n/__tests__/strings.test.ts`.
- **Delivered:** `src/i18n/en.ts`, one typed catalogue of 1548 messages (95 plurals) grouped by feature, and `src/i18n/index.ts`: `t(key, params)` with type-checked keys and `{placeholders}` (a missing key, placeholder or plural `count` does not compile), plurals through `Intl.PluralRules` (English rule where it is missing), numbers through `Intl.NumberFormat` without grouping ("2000 books catalogued", as designed), `translate` for keys held in data, `setCatalogue` and a `[[ ]]` pseudo-locale. Dates: `formatDay` takes order and digits from `Intl.DateTimeFormat` and the month's name from the catalogue, so the day-month-year preference and the loan stamps keep "Sep" (ICU says "Sept" in `en-GB`); the phone's-style option is still `Intl` in the phone's locale. Every user-facing string moved: screens, sheets, dialogs, snackbars, announcements, accessibility labels and hints, placeholders, validation and restore/import errors, Booky's tips and help, onboarding, ratings (P10), notification title and body and the Android channel. Hand-built plurals became plural messages; a few counts that read "1 days", "1 pages", "1 more editions" or "1 columns" at exactly one now say "1 day" and so on. Not moved, by design (`docs/localisation.md`): CSV export headers and the Goodreads column names (a file format), data (titles, names, curated genres, "Untitled"), log and developer errors, test ids. Enforcement: `no-hardcoded-strings.test.ts` (in `npm run check`) fails on JSX text and on literal values of label, hint, placeholder, title, message and similar props and properties, their defaults and `announce()`, outside `src/i18n`, with a reasoned allowlist in `src/testing/hardcodedStrings.ts` (also a CLI). `strings.test.ts`: every key used, no empty message, call sites pass exactly their placeholders, plurals, dates and numbers, switching catalogue, and 23 key screens rendered under the pseudo-locale with nothing untranslated. How to add a language: `docs/localisation.md`. No journey changed. **Not verified:** a device; `a11y-large-text` fails on this machine at `main` too (covers below the fold still downloading after the image gate's 15 s at 200 % text), unrelated to this card.

### P09-12 v1.0 release

- **Description:** Update `README.md` status, `STATUS.md`, version to 1.0.0, tag `v1.0.0`, publish the GitHub Release with APK/AAB and changelog (`CHANGELOG.md` created here, summarising phases).
- **Files:** `README.md`, `STATUS.md`, `CHANGELOG.md`, `app.json`, `package.json`.
- **Acceptance:** release downloadable; install from the APK on a clean device works; all STATUS items ticked.
- **Tests:** release workflow + P09-10 checklist.

---

## Test ids to add to `selectors.json`

```json
{
  "errorBoundary": { "root": "error-boundary-root", "title": "error-boundary-title", "retry": "error-boundary-retry", "copy": "error-boundary-copy", "copied": "error-boundary-copied", "details": "error-boundary-details" },
  "recovery": { "root": "db-recovery-root", "exportRaw": "db-recovery-export-raw" },
  "themeSetting": { "root": "theme-setting", "system": "theme-system", "light": "theme-light", "dark": "theme-dark" }
}
```

## Auto test suite journeys

Each journey is added by the card that builds its screen. Suite `core` journeys run in `smoke` (CI and the regression gate); the rest use suite `p09` (`npm run -s autotest -- journey --suite p09`).

| Journey | Suite | Steps |
|---|---|---|
| `a11y-large-text` | `p09` | text at 200 % (the web E2E font scale, as Android's font size; browser zoom would enlarge the layout too); every tab, book detail, the form, the lend sheet, a series and the covers grid; render gate (no overflow) + a11y gate, nothing cut off |
| `a11y-keyboard-sheets`, `a11y-keyboard-menu-dialog`, `a11y-keyboard-tabs`, `a11y-keyboard-lend-return`, `a11y-help-focus`, `a11y-keyboard-background-reload` | `p09` | keyboard contracts: focus into, trapped in and back out of sheets, dialogs, menus and select lists; Enter and Space on every role; announcements while lending and returning; focus kept through background reloads of the Shelf |
| `theme-dark-gallery` | `p09` | emulate `prefers-color-scheme: dark`; screenshot every main screen; render and a11y gates (contrast itself is checked by `contrast.dark.test.ts`) |
| `shelf-large-scroll` | `perf` | fixture `large`; scroll to end; record timing; no console errors |
| `error-boundary` | `p09` | E2E hook throws in a screen → `errorBoundary.root` → retry recovers |
| `db-open-failure` | `p09` | E2E hook fails the database open (and a migration) → `dbError.root` → retry opens the Shelf |
| `theme-dark-follows-system`, `theme-setting-persist` | `p09` | the theme follows `prefers-color-scheme` live; Appearance Dark persists across a reload and System returns to it |
| `shelf-huge-search` | `perf` | fixture `huge`; search timings (the Shelf's own measure) and a fling to the end in `timing.json`; median query < 100 ms |
| `release-screenshots` | `p09` | capture the curated set for P09-08 |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/release-smoke.yaml` | on the release APK: launch, onboarding, add manual book, lend/return, backup share sheet |
| `.maestro/upgrade-migration.yaml` | manual-assisted (tagged `manual`): install previous release, add data, install new release, data intact |
| full suite | `maestro test .maestro/` on Pixel and Samsung per P09-10 |

`release-smoke.yaml` became `first-run-production.yaml` (the production APK's first run and its inert E2E links) plus the rest of the suite, which runs on release builds (the E2E APK is one). `upgrade-migration.yaml` is not written: there is no previous release yet; an install over the previous build was checked by hand. `error-boundary.yaml` covers P09-04 on the phone. See [`docs/device-testing.md`](../device-testing.md).

## Risks

| Risk | Mitigation |
|---|---|
| Release build differs from dev (minification, Hermes) | E2E profile is release-like; Maestro on release APK |
| Keystore handling | secrets only; offline backup by the owner; documented recovery |
| Samsung-specific behaviour (One UI camera, font sizes) | device pass on a Samsung phone in P09-10 |
| FTS5 missing on some SQLite builds | feature-detect at migration time; `LIKE` fallback |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + lint + typecheck + Jest
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- v1.0.0 tagged; signed APK and AAB attached to a GitHub Release by CI.
- Accessibility audit complete with no open serious issues; dark theme shipped.
- All journeys pass with `--ux-gates fail`; full Maestro suite passes on a Pixel and a Samsung device.
- Every card in `STATUS.md` ticked.
