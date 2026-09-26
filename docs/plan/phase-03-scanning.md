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

### P03-02 Camera permission flow

- **Description:** Scan tab uses `useCameraPermissions()` from `expo-camera` (`npx expo install expo-camera`, add plugin with a camera permission message). States: *undetermined* → Booky (*happy*) explains "I use the camera only to read barcodes and covers — nothing leaves your phone" + "Allow camera"; *denied* → explanation + "Open settings" (`Linking.openSettings()`) + "Type ISBN instead"; *granted* → scanner.
- **Files:** `src/features/scan/ScanScreen.tsx`, `src/features/scan/usePermission.ts`, `src/components/scan/PermissionPrompt.tsx`, `app.json` (plugin config).
- **Acceptance:** each state renders its test id; no camera view mounted without permission.
- **Tests:** `src/features/scan/__tests__/usePermission.test.tsx` (mocked `expo-camera`), `src/__tests__/scan.permission.test.tsx`.

### P03-03 Barcode scanner

- **Description:** `BarcodeScanner` with `CameraView` and `barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}`. Viewfinder overlay shaped like a library card with a scanning line (static when reduce-motion). `onBarcodeScanned` → `parseScannedCode()` → valid Bookland ISBN (978/979 + checksum) → haptic tick + pause scanning → lookup. Non-ISBN codes show "That's a product barcode, not a book's — look for the one starting 978". Same code ignored for 3 s. Torch toggle. After 8 s with no read, Booky (*thinking*) suggests "Read the cover instead".
- **Files:** `src/components/scan/BarcodeScanner.tsx`, `src/components/scan/Viewfinder.tsx`, `src/domain/scannedCode.ts`, `src/features/scan/useScanSession.ts`.
- **Acceptance:** valid ISBN triggers exactly one lookup; ISBN-10 printed as EAN-13 handled; 979-10 prefix accepted; UPC shows the message.
- **Tests:** `src/domain/__tests__/scannedCode.test.ts`, `src/features/scan/__tests__/useScanSession.test.tsx`, `src/components/scan/__tests__/BarcodeScanner.test.tsx` (mocked camera emits codes).

### P03-04 Scan result flow for barcodes

- **Description:** After a valid ISBN: Booky *thinking* sheet "Looking up 978-0-552-16659-1…" with Cancel. One candidate → edition picker (P03-08) with that single candidate pre-selected; none → OCR fallback offer + manual entry; offline → queue in `pending_lookups` and Booky *sleepy* message, then resume scanning.
- **Files:** `src/features/scan/useScanSession.ts`, `src/components/scan/LookupSheet.tsx`.
- **Acceptance:** each branch reachable in tests; cancel returns to live scanning.
- **Tests:** `src/features/scan/__tests__/scanFlow.test.tsx`.

### P03-05 Cover capture and ML Kit OCR

- **Description:** "Read the cover" mode: capture with `CameraView.takePictureAsync({ quality: 0.7 })`, show the photo with a "Use this photo" / "Retake" choice, then run `@react-native-ml-kit/text-recognition` (`npx expo install @react-native-ml-kit/text-recognition`; requires the development build) → `OcrResult { blocks: [{ text, frame: { x, y, width, height }, lines: [...] }] }`. The service interface `recognizeText(uri)` lives in `ocr.native.ts`; `ocr.web.ts` throws `NotSupportedOnWeb`. The photo is deleted after recognition.
- **Files:** `src/services/recognition/ocr.native.ts`, `src/services/recognition/ocr.web.ts`, `src/services/recognition/types.ts`, `src/components/scan/CoverCapture.tsx`.
- **Acceptance:** on device, a clear cover yields title text; the temporary photo file is removed; errors show Booky *concerned* with retry.
- **Tests:** `src/services/recognition/__tests__/ocr.test.ts` (module mocked; mapping of ML Kit output to `OcrResult`), `src/components/scan/__tests__/CoverCapture.test.tsx`.

### P03-06 OCR text → search queries

- **Description:** Pure `buildQueriesFromOcr(result)`: rank lines by frame height; title = top 1–2 largest lines merged (handles titles split across lines); author candidates = lines of 2–4 capitalised words not in the title, preferring ones near the top or bottom edge; strip noise via a list (e.g. "A NOVEL", "BESTSELLER", "WINNER OF", "INTRODUCTION BY", "£/$ prices", "www."); normalise case. Returns up to 3 queries ordered by likelihood: `{ title, author }`, `{ title }`, `{ text }`.
- **Files:** `src/domain/ocrQuery.ts`, `src/domain/__fixtures__/ocr/*.json` (recorded ML Kit outputs from ~15 real covers, photographed by the developer).
- **Acceptance:** for ≥ 12 of 15 fixtures the first query finds the correct work in the recorded search fixtures.
- **Tests:** `src/domain/__tests__/ocrQuery.test.ts`.

### P03-07 Web stub and E2E scan injection

- **Description:** On web the Scan tab shows "Type an ISBN" and "Type the cover text" fields (clearly labelled as the web test harness equivalent) that feed `useScanSession` exactly where the camera and OCR would. In E2E builds, route `src/app/e2e/scan.tsx` accepts `myshelf://e2e/scan?isbn=…` or `?text=…` and injects the result into the active scan session. Both are unavailable in production Android builds.
- **Files:** `src/components/scan/WebScanInput.tsx`, `src/components/scan/ScannerHost.{native,web}.tsx`, `src/app/e2e/scan.tsx`.
- **Acceptance:** the full scan → pick → save flow is runnable in the auto test suite and via Maestro deep link.
- **Tests:** `src/__tests__/scan.web.test.tsx`, `src/app/e2e/__tests__/scan.test.tsx`.

### P03-08 Edition picker

- **Description:** Route `src/app/scan/pick.tsx` (receives candidates via a session store keyed by an id param). Candidates grouped by work (`workKey` or normalised title+author); each work expands to its editions (from `openLibrary.editions` on demand), showing cover, year, publisher, format, pages, ISBN. Filters: format, language. Hint: "Match the publisher and year on the copyright page." Primary action "This is my edition"; secondary "None of these — add manually". Accessible: each edition row reads "Hardcover, Doubleday, 1987, 285 pages, ISBN …".
- **Files:** `src/app/scan/pick.tsx`, `src/components/scan/WorkGroup.tsx`, `src/components/scan/EditionRow.tsx`, `src/features/scan/useEditionPicker.ts`, `src/features/scan/sessionStore.ts`.
- **Acceptance:** single-candidate case skips grouping; loading editions shows skeletons; selection enables the primary button.
- **Tests:** `src/features/scan/__tests__/useEditionPicker.test.tsx`, `src/__tests__/scan.pick.test.tsx`.

### P03-09 Save from candidate

- **Description:** `booksRepo.createBookFromCandidate(db, candidate, overrides)` in one transaction: book row (`source`, `source_id`), authors (reuse by name), genres via normaliser (`user_edited = 0`), series via `extractSeries` (find or create by case-insensitive name) and position, cover download (after commit; failure does not roll back the book). Then navigate to book detail with Booky *excited* "Shelved! That's N books." An optional "Review before saving" toggle routes through `BookForm` instead.
- **Files:** `src/db/repositories/books.ts`, `src/features/scan/useSaveCandidate.ts`.
- **Acceptance:** all related rows created once; re-using existing author/series rows; cover failure leaves book saved with generated cover.
- **Tests:** `src/db/repositories/__tests__/books.fromCandidate.test.ts`, `src/features/scan/__tests__/useSaveCandidate.test.tsx`.

### P03-10 Duplicate detection

- **Description:** Before saving, check `books.findByIsbn13` (and normalised title+author when no ISBN). If found: sheet "Already on your shelf" with the existing card, actions "Open it", "Add another copy", "Cancel".
- **Files:** `src/features/scan/useDuplicateCheck.ts`, `src/components/scan/DuplicateSheet.tsx`.
- **Acceptance:** duplicate prompt appears for an existing ISBN; "Add another copy" creates a second row.
- **Tests:** `src/features/scan/__tests__/useDuplicateCheck.test.tsx`.

### P03-11 Manual fallback with prefill

- **Description:** From any dead end (not found, OCR failed, none match), "Add manually" opens `book/new` prefilled with whatever is known: ISBN from barcode, title/author guesses from OCR (marked "Please check").
- **Files:** `src/app/book/new.tsx` (accept `prefill` session id), `src/features/scan/prefill.ts`.
- **Acceptance:** prefilled values present and editable; nothing saved until the user taps Save.
- **Tests:** `src/features/scan/__tests__/prefill.test.ts`.

### P03-12 Continuous scanning mode

- **Description:** Toggle "Scan several" on the Scan tab: each recognised ISBN with exactly one confident candidate is added straight to a review tray (not yet saved); ambiguous ones are marked "needs a choice". "Review N books" opens a list to confirm, fix or drop each, then saves all in one go. Counter badge and a short haptic per scan.
- **Files:** `src/features/scan/useBatchScan.ts`, `src/app/scan/review.tsx`, `src/components/scan/ScanTray.tsx`.
- **Acceptance:** scanning 5 fixture ISBNs then confirming saves 5 books; dropping one saves 4; leaving the tab keeps the tray for the session.
- **Tests:** `src/features/scan/__tests__/useBatchScan.test.tsx`, `src/__tests__/scan.review.test.tsx`.

### P03-13 Scan screen polish and help

- **Description:** Mode switcher (Barcode / Cover) as a segmented control; last-scanned mini card; help sheet with a diagram of where ISBN barcodes usually are; `?` button hooks into Booky help (full content in P07-05).
- **Files:** `src/features/scan/ScanScreen.tsx`, `src/components/scan/ScanModeSwitch.tsx`, `src/components/scan/ScanHelp.tsx`.
- **Acceptance:** mode persists for the session; help sheet accessible and dismissible.
- **Tests:** `src/__tests__/scan.modes.test.tsx`.

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
npm run check                    # selectors:check + typecheck + Jest (+ lint once P00-20 lands)
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- On a physical Android device: scanning an ISBN barcode adds the correct edition in ≤ 3 taps; reading a cover finds the book for most modern titles.
- Web journeys cover every branch with mocked APIs and pass with `--ux-gates fail`.
- Maestro permission and injection flows pass on the E2E build; manual-assisted flows run and results noted in the PR.
- Regression gate green in CI.
