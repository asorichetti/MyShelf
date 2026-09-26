# Phase 03 — Scanning: barcode, OCR and edition picker

## Goal

The headline feature: point the phone at a book and get it onto the shelf with the right edition. Barcode (EAN-13 ISBN) first; if there is no barcode or the ISBN is unknown, photograph the cover, read it with on-device ML Kit, search, and let the user pick the edition. See `PLAN.md` §7 and [ADR 0003](../adr/0003-isbn-first-ocr-fallback-recognition.md).

## Scope

- Development and E2E build profiles (ML Kit needs a development build).
- Camera permission UX; barcode scanner; ISBN validation; duplicate-read debounce.
- Cover capture + ML Kit text recognition; OCR text → search query builder.
- Web stubs (typed ISBN / typed cover text) and E2E deep-link scan injection.
- Edition picker grouped by work; save from candidate in one transaction; duplicate detection; continuous scanning.

## Out of scope

- Metadata fetching internals (Phase 02). Series UI (Phase 04).
- Cover image similarity matching (rejected in ADR 0003).

## Prerequisites

- Phase 02 complete (`metadataService`, `BookCandidate`, `candidateToDraft`, cover download).
- Android emulator with a virtual camera, or a physical Android device.

---

## Task cards

### P03-01 Development and E2E builds

- **Description:** Add `expo-dev-client` (`npx expo install expo-dev-client`) and `eas.json` with profiles: `development` (dev client, internal APK), `e2e` (release-like APK with `EXPO_PUBLIC_E2E=1`), `preview` (internal APK), `production` (AAB, `autoIncrement` versionCode). Document local builds (`npx expo run:android`, `eas build --local --profile e2e -p android`) in `AGENTS.md` and `.maestro/README.md`. Update Maestro flows to target the E2E build.
- **Files:** `eas.json`, `package.json`, `AGENTS.md`, `.maestro/README.md`.
- **Acceptance:** a development build installs and loads the JS bundle from Metro; an E2E APK builds locally without EAS cloud.
- **Tests:** `maestro test .maestro/launch.yaml` against the E2E build.
- **Partly delivered:** only the configuration the scan cards needed: `eas.json` with `e2e` (internal APK, `EXPO_PUBLIC_E2E=1`, so `/e2e` and `/e2e/scan` exist for Maestro), `preview` (internal APK) and `production` (AAB, `autoIncrement`) profiles, and the `expo-camera` config plugin in `app.json` (camera permission text, no microphone or audio recording, barcode scanning on). **Not done and not verified:** `expo-dev-client` and the `development` profile, the AGENTS/Maestro documentation, and any build: the Android SDK is not installed on the machine this was written on, so neither a development build nor a local E2E APK was attempted, and the profiles have not been checked by `eas-cli`. `npx expo export --platform android` bundles successfully with the camera and haptics modules. *Update (P09-06):* `production` no longer uses `autoIncrement`; versions come from the release tag (`scripts/release-version.mjs`, `docs/release.md`).

### P03-02 Camera permission flow — done

- **Description:** Scan tab uses `useCameraPermissions()` from `expo-camera` (`npx expo install expo-camera`, add plugin with a camera permission message). States: *undetermined* → Booky (*happy*) explains "I use the camera only to read barcodes and covers — nothing leaves your phone" + "Allow camera"; *denied* → explanation + "Open settings" (`Linking.openSettings()`) + "Type ISBN instead"; *granted* → scanner.
- **Files:** `src/features/scan/ScanScreen.tsx`, `src/features/scan/usePermission.ts`, `src/components/scan/PermissionPrompt.tsx`, `app.json` (plugin config).
- **Acceptance:** each state renders its test id; no camera view mounted without permission.
- **Tests:** `src/features/scan/__tests__/usePermission.test.tsx` (mocked `expo-camera`), `src/__tests__/scan.permission.test.tsx`.
- **Delivered:** `expo-camera` 57.0.5 (`npx expo install`) with its config plugin in `app.json`. `usePermission` (`src/features/scan/usePermission.ts`) maps `useCameraPermissions()` to `loading` / `undetermined` / `granted` / `denied`; a denial the system would still ask about again counts as undetermined, so the explanation and "Allow camera" come back. `PermissionPrompt` (`src/components/scan/PermissionPrompt.tsx`): Booky *happy* with "I use the camera only to read barcodes and covers — nothing leaves your phone." and Allow camera; denied → Booky *concerned*, Open settings (`Linking.openSettings()`) and "Type ISBN instead" (in cover mode, "Type the cover text instead"). The camera view is mounted only once granted (`ScannerHost.tsx`). Tests mock `expo-camera` through `src/testing/mockCamera.tsx`. **Not verified on a device:** the system prompt, the settings link and the live camera need a development build (P03-01); only the logic and rendering are tested (Jest).

### P03-03 Barcode scanner — done

- **Description:** `BarcodeScanner` with `CameraView` and `barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}`. Viewfinder overlay shaped like a library card with a scanning line (static when reduce-motion). `onBarcodeScanned` → `parseScannedCode()` → valid Bookland ISBN (978/979 + checksum) → haptic tick + pause scanning → lookup. Non-ISBN codes show "That's a product barcode, not a book's — look for the one starting 978". Same code ignored for 3 s. Torch toggle. After 8 s with no read, Booky (*thinking*) suggests "Read the cover instead".
- **Files:** `src/components/scan/BarcodeScanner.tsx`, `src/components/scan/Viewfinder.tsx`, `src/domain/scannedCode.ts`, `src/features/scan/useScanSession.ts`.
- **Acceptance:** valid ISBN triggers exactly one lookup; ISBN-10 printed as EAN-13 handled; 979-10 prefix accepted; UPC shows the message.
- **Tests:** `src/domain/__tests__/scannedCode.test.ts`, `src/features/scan/__tests__/useScanSession.test.tsx`, `src/components/scan/__tests__/BarcodeScanner.test.tsx` (mocked camera emits codes).
- **Delivered:** `parseScannedCode` (`src/domain/scannedCode.ts`) classifies a read as `isbn` (EAN-13 978/979 with a valid checksum; an ISBN-10 book's EAN-13 is its 978 form; any `ean13` type spelling, `EAN_13`, `org.gs1.EAN-13`), `product` (other EAN-13 prefixes including 977 ISSNs, UPC-A, EAN-8 with valid check digits) or `invalid` (ignored), and `isRepeatRead` drops the same code within 3 s. `BarcodeScanner` (`src/components/scan/BarcodeScanner.tsx`): `CameraView` with `barcodeTypes: ['ean13', 'ean8', 'upc_a']`, reads switched off while paused, a torch toggle, the library-card `Viewfinder` with a scan line that stands still with reduce motion, and Booky *thinking* "No barcode? Try reading the cover instead." after 8 s without a read. `useScanSession.onBarcode` ticks (`expo-haptics`, `features/scan/haptics.ts`; nothing on web), pauses and looks the ISBN up once; a product code shows "That's a product barcode, not a book's — look for the one starting 978 or 979." **Not verified on a device:** real barcode reading, the torch and haptics (Maestro `scan-barcode-live` needs a phone).

### P03-04 Scan result flow for barcodes — done

- **Description:** After a valid ISBN: Booky *thinking* sheet "Looking up 978-0-552-16659-1…" with Cancel. One candidate → edition picker (P03-08) with that single candidate pre-selected; none → OCR fallback offer + manual entry; offline → queue in `pending_lookups` and Booky *sleepy* message, then resume scanning.
- **Files:** `src/features/scan/useScanSession.ts`, `src/components/scan/LookupSheet.tsx`.
- **Acceptance:** each branch reachable in tests; cancel returns to live scanning.
- **Tests:** `src/features/scan/__tests__/scanFlow.test.tsx`.
- **Delivered:** in `useScanSession` (no separate `LookupSheet.tsx`: the Scan screen shows the lookup as an inline Booky bubble, `scan.lookupSheet`, *thinking*, "Looking up 978-0-552-16659-1…" with the ISBN hyphenated by `formatIsbn13`, and Cancel, which aborts the request and resumes scanning). Found (one or more candidates) → the edition picker, the single candidate pre-selected; nothing → Booky *concerned* with "Add it by hand" (prefilled, P03-11) and "Read the cover instead"; offline → the ISBN goes into `pending_lookups` through the tab shell's queue (Booky *sleepy* "Saved — I'll look this up when you're back online.") and scanning resumes; any other failure → a gentle error with Try again. Tests: `src/features/scan/__tests__/scanFlow.test.tsx` (every branch on the Scan screen) and `useScanSession.test.tsx`.

### P03-05 Cover capture and ML Kit OCR

- **Description:** "Read the cover" mode: capture with `CameraView.takePictureAsync({ quality: 0.7 })`, show the photo with a "Use this photo" / "Retake" choice, then run `@react-native-ml-kit/text-recognition` (`npx expo install @react-native-ml-kit/text-recognition`; requires the development build) → `OcrResult { blocks: [{ text, frame: { x, y, width, height }, lines: [...] }] }`. The service interface `recognizeText(uri)` lives in `ocr.native.ts`; `ocr.web.ts` throws `NotSupportedOnWeb`. The photo is deleted after recognition.
- **Files:** `src/services/recognition/ocr.native.ts`, `src/services/recognition/ocr.web.ts`, `src/services/recognition/types.ts`, `src/components/scan/CoverCapture.tsx`.
- **Acceptance:** on device, a clear cover yields title text; the temporary photo file is removed; errors show Booky *concerned* with retry.
- **Tests:** `src/services/recognition/__tests__/ocr.test.ts` (module mocked; mapping of ML Kit output to `OcrResult`), `src/components/scan/__tests__/CoverCapture.test.tsx`.
- **Partly delivered:** `@react-native-ml-kit/text-recognition` 2.0.0 installs but `expo-doctor` flags it "Untested on New Architecture" (React Native 0.86 has no other), and the maintained Expo-module alternative, `expo-text-extractor` 2.0.0, returns block texts without the frames the query builder needs, so no text-recognition module was added. What exists: the interface (`src/services/recognition/types.ts`: `OcrResult` blocks → lines with pixel frames and an optional confidence, `RecognizeText`, `NotSupportedOnWeb`, `OcrUnavailableError`), `fromMlKit` (ML Kit's `{ left, top, width, height }` or `x`/`y` frames → `OcrResult`, tested), `ocr.ts` (reports itself unavailable until a native module is proven on a device) and `ocr.web.ts` (throws `NotSupportedOnWeb`). `CoverCapture` (`src/components/scan/CoverCapture.tsx`) takes a photo with `takePictureAsync({ quality: 0.7 })`, offers "Use this photo" / "Retake", reads it, and shows Booky *concerned* with Try again on failure; while the build has no reader it offers typed cover text instead, exactly like the web. The photo is kept with the scan session and deleted when the session ends (`endSession`), not straight after recognition, so P03-14 can offer it as the cover. **Remaining:** choose and prove a text-recognition module in a development build on a phone, and record real ML Kit captures.

### P03-06 OCR text → search queries

- **Description:** Pure `buildQueriesFromOcr(result)`: rank lines by frame height; title = top 1–2 largest lines merged (handles titles split across lines); author candidates = lines of 2–4 capitalised words not in the title, preferring ones near the top or bottom edge; strip noise via a list (e.g. "A NOVEL", "BESTSELLER", "WINNER OF", "INTRODUCTION BY", "£/$ prices", "www."); normalise case. Returns up to 3 queries ordered by likelihood: `{ title, author }`, `{ title }`, `{ text }`.
- **Files:** `src/domain/ocrQuery.ts`, `src/domain/__fixtures__/ocr/*.json` (recorded ML Kit outputs from ~15 real covers, photographed by the developer).
- **Acceptance:** for ≥ 12 of 15 fixtures the first query finds the correct work in the recorded search fixtures.
- **Tests:** `src/domain/__tests__/ocrQuery.test.ts`.
- **Partly delivered:** `buildQueriesFromOcr` (`src/domain/ocrQuery.ts`) cleans lines (stray symbols such as "~" and "+" dropped, "&" between names kept), drops cover furniture (blurbs, prices, prizes, imprints, "A NOVEL", "A Memoir of…" subtitles, quoted endorsements, series lines), joins a name set over stacked lines ("ALICE" / "HOFFMAN"), picks the byline (a lone name-like text that dwarfs everything is the title; of several, the smallest; a name-like line stacked against a title line continues the title; possessives are never names), then the title: the largest remaining text, preferring the top, with neighbours set nearly as large. Queries go out lower-cased: `{ title, author }`, `{ title }`, `{ text }`. `queriesFromTypedText` reads the web harness's typed text the same way. `searchCover` (`src/features/scan/coverSearch.ts`) tolerates misreads in at most five searches: title + author; then the author alone, keeping books whose title is close (`titleSimilarity` in `src/domain/titleMatch.ts`: edit and word-overlap similarity after normalising); then the title without its last word; then the other queries; results are ordered by closeness to the cover's title. Fixtures: 15 hand-written captures (`synthetic: true`) and **3 real ones** (`synthetic: false`, `real-*.json`) recorded with Apple Vision from the developer's phone photos as a stand-in for ML Kit, with `scripts/record-ocr-fixture.swift` (macOS only; the photos are not committed). All 18 first queries are right (the builder was tuned on these fixtures, so this overstates real-world accuracy); `src/features/scan/__live__/coverOcr.live.ts` (`npm run test:live`) runs the three real captures against the live Open Library and finds all three books, each with a real cover (Problematic Summer Romance through the author fallback: Vision read "BROMANCE"). The recorded searches are in the fixture index for `coverSearch.test.ts`. **Remaining:** the card's ~15 real ML Kit captures from a device.

### P03-07 Web stub and E2E scan injection — done

- **Description:** On web the Scan tab shows "Type an ISBN" and "Type the cover text" fields (clearly labelled as the web test harness equivalent) that feed `useScanSession` exactly where the camera and OCR would. In E2E builds, route `src/app/e2e/scan.tsx` accepts `myshelf://e2e/scan?isbn=…` or `?text=…` and injects the result into the active scan session. Both are unavailable in production Android builds.
- **Files:** `src/components/scan/WebScanInput.tsx`, `src/components/scan/ScannerHost.{native,web}.tsx`, `src/app/e2e/scan.tsx`.
- **Acceptance:** the full scan → pick → save flow is runnable in the auto test suite and via Maestro deep link.
- **Tests:** `src/__tests__/scan.web.test.tsx`, `src/app/e2e/__tests__/scan.test.tsx`.
- **Delivered:** following the platform-file convention in the code, `ScannerHost.tsx` is the phone's (camera, cover capture, typed ISBN fallback) and `ScannerHost.web.tsx` the web harness: labelled "Web test harness", with "Type an ISBN" (`scan.webIsbn`) in barcode mode and "Type the cover text" (`scan.webText`, one line per cover line) in cover mode, feeding `useScanSession` exactly where the camera and OCR would (`WebScanInput.tsx`). `/e2e/scan?isbn=…` or `?text=…` (`src/app/e2e/scan.tsx` → `E2eScanScreen`) exists only with the E2E loader (ADR 0015: web unless `EXPO_PUBLIC_E2E=0`, Android only with `=1`); it queues the scan (`scanInjector.ts`) and opens the Scan tab, which takes it on mount. Its Jest test is `src/features/e2e/__tests__/scanInjection.test.tsx`, not under `src/app` (every file there is a route). Journeys: `scan-web-isbn-single` (core), `scan-web-cover-text`, `scan-not-found-manual`, `scan-duplicate`, `scan-batch-review`, `scan-e2e-inject` (p03). **Not verified:** the Maestro deep link (no device, no `.maestro/` yet).

### P03-08 Edition picker — done

- **Description:** Route `src/app/scan/pick.tsx` (receives candidates via a session store keyed by an id param). Candidates grouped by work (`workKey` or normalised title+author); each work expands to its editions (from `openLibrary.editions` on demand), showing cover, year, publisher, format, pages, ISBN. Filters: format, language. Hint: "Match the publisher and year on the copyright page." Primary action "This is my edition"; secondary "None of these — add manually". Accessible: each edition row reads "Hardcover, Doubleday, 1987, 285 pages, ISBN …".
- **Files:** `src/app/scan/pick.tsx`, `src/components/scan/WorkGroup.tsx`, `src/components/scan/EditionRow.tsx`, `src/features/scan/useEditionPicker.ts`, `src/features/scan/sessionStore.ts`.
- **Acceptance:** single-candidate case skips grouping; loading editions shows skeletons; selection enables the primary button.
- **Tests:** `src/features/scan/__tests__/useEditionPicker.test.tsx`, `src/__tests__/scan.pick.test.tsx`.
- **Delivered:** `/scan/pick?session=<id>` (`EditionPickerScreen`, `useEditionPicker`, `sessionStore.ts`; a reloaded picker says "This scan has expired"). A single ISBN result shows alone and selected ("Is this your book?"). A cover search is grouped by work (`groupByWork`: Open Library work key, else title + first author, so a Google Books volume joins its work); each `WorkGroup` is a disclosure button (`aria-expanded`) that loads the work's editions on demand with three skeleton cards, shows the first 20 with "Show more", and lets a work with no loadable editions be chosen itself; format and language filters appear once the loaded editions differ. The hint reads "Match the publisher and year on the copyright page, just inside the cover." Editions are radio cards (`EditionRow`) read as "Paperback, Corgi, 1990, 288 pages, ISBN 9780552124751, The Colour of Magic, from Open Library"; "This is my edition" is enabled by a selection; "None of these — add manually" opens the prefilled form. The chosen edition inherits its work's subjects, series hints, summary and key (`enrichEdition`).

### P03-09 Save from candidate — done

- **Description:** `booksRepo.createBookFromCandidate(db, candidate, overrides)` in one transaction: book row (`source`, `source_id`), authors (reuse by name), genres via normaliser (`user_edited = 0`), series via `extractSeries` (find or create by case-insensitive name) and position, cover download after commit with `attachCoverFromCandidate` (P02-15; failure does not roll back the book). Then navigate to book detail with Booky *excited* "Shelved! That's N books." An optional "Review before saving" toggle routes through `BookForm` instead.
- **Files:** `src/db/repositories/books.ts`, `src/features/scan/useSaveCandidate.ts`.
- **Acceptance:** all related rows created once; re-using existing author/series rows; cover failure leaves book saved with generated cover.
- **Tests:** `src/db/repositories/__tests__/books.fromCandidate.test.ts`, `src/features/scan/__tests__/useSaveCandidate.test.tsx`.
- **Delivered:** `booksRepo.createBookFromCandidate(db, candidate, overrides)` (in `src/db/repositories/bookLookups.ts`, re-exported from `books.ts`) writes the book (`source`, `source_id`, brief summary, valid ISBNs, ISBN-13 derived from an ISBN-10), its authors (reused by name) and its normalised genres (`user_edited = 0`) in one transaction. `saveCandidate` / `useSaveCandidate` (`src/features/scan/useSaveCandidate.ts`) then links the series through `applyDetectedSeries` (the series feature's find-or-create by name, with "Is this Discworld #5?" for weaker guesses) inside `beginSeriesSave` / `probe.finish` for the gap tip and celebration, emits `library-changed`, and stores the real cover with `attachCoverFromCandidate` in the background (a failure leaves the book with its generated cover; `onNoOnlineCover` is the hook for P03-14). The picker navigates to the new book, where Booky is *excited*: "Shelved! That's N books." (a stack-screen tip host, `StackBookyTipHost`, now shows Booky's tips outside the tabs, except on screens whose bottom bar holds the primary action). "Review before saving" (`picker.review`) opens the add form filled from the candidate instead; saving there keeps its source and real cover.

### P03-10 Duplicate detection — done

- **Description:** Before saving, check `books.findByIsbn13` (and normalised title+author when no ISBN). If found: sheet "Already on your shelf" with the existing card, actions "Open it", "Add another copy", "Cancel".
- **Files:** `src/features/scan/useDuplicateCheck.ts`, `src/components/scan/DuplicateSheet.tsx`.
- **Acceptance:** duplicate prompt appears for an existing ISBN; "Add another copy" creates a second row.
- **Tests:** `src/features/scan/__tests__/useDuplicateCheck.test.tsx`.
- **Delivered:** `findDuplicates` / `useDuplicateCheck` (`src/features/scan/useDuplicateCheck.ts`) match the ISBN-13 or ISBN-10, or, for a candidate without one, the title and first author (`bookMatchKey`). `DuplicateSheet` (on the shared `Sheet`) shows "Already on your shelf" with the existing card and Open it / Add another copy / Cancel. The batch tray saves without this check (noted for P03-12).

### P03-11 Manual fallback with prefill — done

- **Description:** From any dead end (not found, OCR failed, none match), "Add manually" opens `book/new` prefilled with whatever is known: ISBN from barcode, title/author guesses from OCR (marked "Please check").
- **Files:** `src/app/book/new.tsx` (accept `prefill` session id), `src/features/scan/prefill.ts`.
- **Acceptance:** prefilled values present and editable; nothing saved until the user taps Save.
- **Tests:** `src/features/scan/__tests__/prefill.test.ts`.
- **Delivered:** `prefill.ts` (`putPrefill` / `getPrefill`, `prefillFromScan`, `prefillFromCandidate`, `titleCase`); `/book/new?prefill=<id>` merges the draft into the existing `prefill` mechanism of `useBookForm` (the one `?series=&position=` uses). A barcode's ISBN is exact; title and author guesses from a cover are marked with a Booky "Please check" notice (`prefill.notice`) at the top of the form. Reached from "Add it by hand" (Scan tab) and "None of these — add manually" (picker). Nothing is saved until Save.

### P03-12 Continuous scanning mode — done

- **Description:** Toggle "Scan several" on the Scan tab: each recognised ISBN with exactly one confident candidate is added straight to a review tray (not yet saved); ambiguous ones are marked "needs a choice". "Review N books" opens a list to confirm, fix or drop each, then saves all in one go. Counter badge and a short haptic per scan.
- **Files:** `src/features/scan/useBatchScan.ts`, `src/app/scan/review.tsx`, `src/components/scan/ScanTray.tsx`.
- **Acceptance:** scanning 5 fixture ISBNs then confirming saves 5 books; dropping one saves 4; leaving the tab keeps the tray for the session.
- **Tests:** `src/features/scan/__tests__/useBatchScan.test.tsx`, `src/__tests__/scan.review.test.tsx`.
- **Delivered:** "Scan several" (`scan.batchToggle`) sends each recognised book to the tray (`src/features/scan/useBatchScan.ts`, in memory for the app session, so leaving the tab keeps it): an ISBN with exactly one candidate is ready, a cover search or several candidates "needs a choice" (chosen later through the picker, which then returns to the review). `ScanTray` shows the count badge and "Review N books"; `/scan/review` (`ScanReviewScreen`) lists the books with Drop, and "Save N books" saves the ready ones in one go (Booky: "Shelved 2 books! That's 2 books in all."), then returns to the Shelf in the same tab shell. Each scan gets the barcode haptic tick. Not done: a per-item "fix" (edit before saving) beyond choosing the edition, and the duplicate check for tray items.

### P03-13 Scan screen polish and help — done

- **Description:** Mode switcher (Barcode / Cover) as a segmented control; last-scanned mini card; help sheet with a diagram of where ISBN barcodes usually are; `?` button hooks into Booky help (full content in P07-05).
- **Files:** `src/features/scan/ScanScreen.tsx`, `src/components/scan/ScanModeSwitch.tsx`, `src/components/scan/ScanHelp.tsx`.
- **Acceptance:** mode persists for the session; help sheet accessible and dismissible.
- **Tests:** `src/__tests__/scan.modes.test.tsx`.
- **Delivered:** `ScanModeSwitch` (Barcode / Cover as a radio group), remembered for the app session; the last book found as a mini card (`scan.lastScanned`, also remembered, since the Scan tab unmounts while the picker is open); `ScanHelp` (on the shared `Sheet`): a back-cover diagram with the barcode's usual place, what to do without one, and the cover alternative, opened by the `?` button (`scan.help`) and dismissed with "Got it", Escape, back or the scrim.

### P03-14 Use the cover photo when no online cover exists

- **Description:** Real art first (PLAN §6 "Covers: real art first"): when a book found through cover capture (P03-05) is saved and the cover chain finds no online cover (`attachCoverFromCandidate` returns `none`), offer the photo the user took as the book's cover: show it in the 2:3 cover frame with "Use my photo" / "No thanks" (Booky *happy*). On confirm, keep the photo instead of deleting it after recognition, store it with `storeCoverFile(bookId, uri)` and set `cover_uri`; on decline, delete it as P03-05 does. An online cover always wins when one exists, and a confirmed photo is never replaced by the backfill (it only looks at books without a cover). The photo is the one taken for recognition, so no second shot is needed.
- **Files:** `src/components/scan/CoverCapture.tsx`, `src/features/scan/useSaveCandidate.ts`, `src/components/scan/UsePhotoAsCover.tsx`.
- **Acceptance:** no online cover → the prompt shows the photo → confirm stores it as the cover; decline (or an online cover found) deletes the photo; the photo is kept only until the save finishes.
- **Tests:** `src/features/scan/__tests__/useSaveCandidate.cover.test.tsx`, `src/components/scan/__tests__/UsePhotoAsCover.test.tsx`.

---

## Test ids to add to `selectors.json`

```json
{
  "scan": {
    "root": "scan-root", "title": "scan-title", "permissionPrompt": "scan-permission-prompt",
    "permissionAllow": "scan-permission-allow", "permissionDenied": "scan-permission-denied",
    "openSettings": "scan-open-settings", "camera": "scan-camera", "torch": "scan-torch",
    "modeBarcode": "scan-mode-barcode", "modeCover": "scan-mode-cover",
    "capture": "scan-capture", "usePhoto": "scan-use-photo", "retake": "scan-retake",
    "webIsbn": "scan-web-isbn", "webIsbnSubmit": "scan-web-isbn-submit",
    "webText": "scan-web-text", "webTextSubmit": "scan-web-text-submit",
    "lookupSheet": "scan-lookup-sheet", "lookupCancel": "scan-lookup-cancel",
    "notBookBarcode": "scan-not-book-barcode", "readCoverInstead": "scan-read-cover-instead",
    "batchToggle": "scan-batch-toggle", "trayCount": "scan-tray-count", "reviewOpen": "scan-review-open",
    "help": "scan-help"
  },
  "picker": {
    "root": "picker-root", "work": "picker-work", "edition": "picker-edition",
    "filterFormat": "picker-filter-format", "confirm": "picker-confirm", "none": "picker-none"
  },
  "duplicate": { "sheet": "duplicate-sheet", "open": "duplicate-open", "addCopy": "duplicate-add-copy", "cancel": "duplicate-cancel" },
  "scanReview": { "root": "scan-review-root", "item": "scan-review-item", "drop": "scan-review-drop", "saveAll": "scan-review-save-all" }
}
```

(`scan.root` and `scan.title` already exist from P00-11 — keep them, add the rest.)

## Auto test suite journeys

Each journey is added by the card that builds its screen. Suite `core` journeys run in `smoke` (CI and the regression gate); the rest use suite `p03` (`npm run -s autotest -- journey --suite p03`).

| Journey | Suite | Steps |
|---|---|---|
| `scan-web-isbn-single` | `core` | fixture `empty`, mocks; `/scan`; type ISBN → picker with one edition → confirm → detail; Booky excited bubble |
| `scan-web-cover-text` | `p03` | type cover text "THE COLOUR OF MAGIC TERRY PRATCHETT" → picker groups → expand work → choose edition → saved with series Discworld #1 |
| `scan-not-found-manual` | `p03` | ISBN with no results → "Add manually" → form prefilled with ISBN |
| `scan-duplicate` | `p03` | fixture `demo`; type ISBN of an existing book → duplicate sheet → add another copy → 13 rows |
| `scan-batch-review` | `p03` | batch toggle; type 3 ISBNs → tray count 3 → review → drop 1 → save all → 2 new rows |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/scan-permission.yaml` | fresh install: Scan tab → permission prompt → allow system dialog → camera view visible; deny path shows settings link |
| `.maestro/scan-inject-isbn.yaml` | E2E build: open `myshelf://e2e?fixture=empty&next=/scan`, then `myshelf://e2e/scan?isbn=9780552166591` → picker → confirm → detail |
| `.maestro/scan-cover-ocr.yaml` | manual-assisted (tagged `manual`): with a printed cover in front of the camera, capture → OCR → picker shows candidates |
| `.maestro/scan-barcode-live.yaml` | manual-assisted (tagged `manual`): scan a printed EAN-13 test sheet; the book appears in the picker |

## Risks

| Risk | Mitigation |
|---|---|
| ML Kit module incompatible with the current SDK/New Architecture | verify in P03-01 spike before building UI; fallback: `expo-camera` barcode only + typed search, and track an issue |
| Barcode scanning unreliable in low light | torch toggle, Booky tip, typed ISBN fallback |
| OCR picks up blurbs instead of titles | height-based ranking, noise list, 3 query variants, user always confirms |
| Camera cannot be automated in CI | web stub + E2E deep link injection; manual-assisted Maestro flows before phase close |
| Edition lists are long for popular works | filters, sort by year, show first 20 with "show more" |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + lint + typecheck + Jest
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- On a physical Android device: scanning an ISBN barcode adds the correct edition in ≤ 3 taps; reading a cover finds the book for most modern titles.
- Web journeys cover every branch with mocked APIs and pass with `--ux-gates fail`.
- Maestro permission and injection flows pass on the E2E build; manual-assisted flows run and results noted in the PR.
- Regression gate green in CI.
