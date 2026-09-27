# Phase 08 — Settings, backup, export and import

## Goal

Give the user control and peace of mind: sensible preferences, a full backup they can save anywhere and restore on a new phone, CSV export for spreadsheets, CSV import (including from a Goodreads export) to get started quickly, and an About screen that credits the data sources.

## Scope

- Settings screen and preferences.
- JSON full backup and restore (with schema version and forward migration).
- CSV export and CSV import with column mapping and a Goodreads preset.
- Backup reminder; manage borrowers and pending lookups; clear all data.
- About screen with licences and attribution.

## Out of scope

- Cloud sync or automatic cloud backup ([ADR 0012](../adr/0012-local-only-data.md)).
- Importing from paid services' APIs.

## Prerequisites

- Phases 01–06 (all tables in use). Phase 07 for Booky settings (linked from here).

---

## Task cards

### P08-01 Settings screen — done

- **Description:** Settings tab as grouped sections: **Library** (default sort, group by, view mode, default loan length), **Booky** (→ P07-06 screen), **Lookups** (Google Books on/off, download covers on mobile data on/off, pending lookups list with retry/remove), **Lending** (reminders toggle from P05-08, manage borrowers), **Backup & data** (export, import, CSV, clear data), **About**. Typed settings access with defaults in `src/db/repositories/settings.ts`.
- **Files:** `src/features/settings/SettingsScreen.tsx`, `src/app/settings/*.tsx`, `src/components/settings/SettingsRow.tsx`, `src/features/settings/useSettings.ts`.
- **Acceptance:** every row has a label, value and accessible role (switch/button/link); changes apply immediately and persist.
- **Tests:** `src/features/settings/__tests__/useSettings.test.tsx`, `src/__tests__/settingsTab.test.tsx`.
- **Delivered:** the Settings tab (`src/features/settings/SettingsScreen.tsx`) has one h1 and five h2 sections: **Library** (a "Shelf and lending" row summarising sort and loan length, opening P08-07's screen), **Lookups** (Google Books and "Fetch covers on mobile data" switches, Pending lookups), **Lending** (the P05-08 reminders switch, Borrowers), **Backup & data** (back up, restore, export CSV, import CSV, erase) and **About**. Rows are `SettingsLinkRow` (`role="link"`, 56 px, icon in a soft purple circle, label, value or explanation, chevron) and `SettingsSwitchRow` (`role="switch"`) in `src/components/settings/SettingsRow.tsx`; each detail screen is a route under `src/app/settings/` built on `SettingsPage` (Back to Settings, one h1). `useSettings` (`src/features/settings/useSettings.ts`) gives typed access through the existing `settingsRepo`, updates at once, persists and emits `settings-changed`. The Google Books row says whether Google Books is on and whether this build has its own access key (`GOOGLE_BOOKS_KEYED`, a boolean from `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`); the key itself is never shown or stored. **Booky:** the section is a marked slot in `SettingsScreen` (`bookySection`, between Library and Lookups) for the Booky track's `BookySettingsSection` (P07-06); nothing is rendered there yet.

### P08-02 JSON backup export — done

- **Description:** `exportBackup(db)` → `{ format: 'myshelf-backup', formatVersion: 1, schemaVersion, appVersion, exportedAt, tables: { books: [...], authors: [...], ... } }` (all tables except `api_cache`; covers optional as base64 in a zip is **out of scope** — covers are re-downloadable). Write to a cache file `myshelf-backup-YYYY-MM-DD.json` with `expo-file-system` and open the share sheet with `expo-sharing` (install both with `npx expo install`). On web, trigger a download. Record `backup.lastAt` in settings.
- **Files:** `src/services/backup/exportBackup.ts`, `src/services/backup/shareFile.{native,web}.ts`, `src/app/settings/backup.tsx`.
- **Acceptance:** export of `demo` round-trips through import (P08-03) to an identical database (row-by-row compare).
- **Tests:** `src/services/backup/__tests__/exportBackup.test.ts` (node env).
- **Delivered:** the format is described in `src/domain/backup.ts` (`backupTables`: every table, its columns, key, links and the schema version that added it). `exportBackup` dumps every table except `api_cache`, `cover_attempts`, `backup_snapshots` and `schema_migrations` in one transaction, with `format`, `formatVersion: 1`, `schemaVersion`, `appVersion`, `exportedAt`, `counts` and a `covers` note; the settings in `deviceSettingKeys` (`backup.lastAt` and the reminder's state) describe the phone and are left out. **Covers:** a cover stored on the phone (`file://…`) cannot travel in a JSON file, so its `cover_uri` is written as null and the cover backfill fetches a real cover again after a restore (a photo the user took of a cover is replaced by an online cover; a restore on the same phone keeps nothing stale because the restore clears `cover_attempts`). Remote cover URLs (the web build) and `data:` pictures travel as they are. Settings → Back up your library (`BackupScreen`) shows what the file will hold, then `shareFile` writes `myshelf-backup-YYYY-MM-DD.json` to the cache and opens the Android share sheet (`shareFile.ts`, expo-file-system + expo-sharing), or downloads it on the web (`shareFile.web.ts`); `backup.lastAt` is recorded after the sheet closes. The native module is a default `shareFile.ts` plus `shareFile.web.ts`, following the repo's platform-file convention.

### P08-03 JSON backup import (restore) — done

- **Description:** Pick a file (`expo-document-picker`, installed with `npx expo install expo-document-picker`; `<input type=file>` on web), parse and validate (format name, versions, required columns, referential integrity) with clear error messages. If `schemaVersion` < current, load into a temporary in-memory DB at that version and run migrations forward before copying. Modes: **Replace everything** (typed confirmation "REPLACE") or **Merge** (skip books whose `isbn13 + title` already exist; remap ids). Runs in one transaction; on failure nothing changes.
- **Files:** `src/services/backup/importBackup.ts`, `src/services/backup/validateBackup.ts`, `src/services/backup/pickFile.{native,web}.ts`, `src/app/settings/restore.tsx`.
- **Acceptance:** corrupt file → friendly error, DB untouched; old-version backup restored correctly; merge remaps foreign keys.
- **Tests:** `src/services/backup/__tests__/importBackup.test.ts`, `validateBackup.test.ts` with fixture backups (current, older, corrupt, tampered ids).
- **Delivered:** `parseBackup` / `validateBackup` refuse, with a friendly `BackupError` and "Nothing was changed.": empty files, text that is not JSON (every truncation of a real backup is tested), foreign JSON, a newer format or schema ("Update the app, then try again."), unknown or missing tables, rows with unknown fields, wrong types, blank titles or names, duplicate keys, and links to rows that are not in the file. A backup from an older schema is loaded into an in-memory scratch database migrated to its version and brought forward by the real migrations (`backupRepo.upgradeTables`; `openScratchDatabase` opens `:memory:` with expo-sqlite, which also works on the web); fixture `backup-schema1.json` covers it in Jest and on the web. **Replace** (typed REPLACE, case-insensitive) swaps every table for the backup's with the same ids and, in the same transaction, saves the library as it was into the new `backup_snapshots` table (migration `0005_backup_snapshots`, one row kept): "Undo restore" on the result, and on the Restore screen until the next restore or erase, puts it back. **Merge** adds books whose ISBN-13 + title are not on the shelf, matches authors, genres, series, groups and borrowers by name, remaps every id and leaves settings alone. Any database error rolls back and becomes "This backup looks damaged: … Nothing was changed.". After a restore the cover backfill runs until every book without a cover has been looked at (`drainCoverBackfill`): one batch search for the cover ids of all the restored books, then covers by id, three at a time, each shown as it arrives. The fixture `backup-phone-covers.json` is the Goodreads fixture's 20 books as a phone would back them up (every cover a file, so written as null; Google Books off); the `restore-covers-backfill` and `live-restore-covers` journeys restore it and wait for every cover (about 10 s against the real Open Library). The picker is `pickFile.ts` (expo-document-picker, then `File.text()`) and `pickFile.web.ts` (a hidden `<input type="file">`).

### P08-04 CSV export — done

- **Description:** Flat CSV of books: title, subtitle, authors (`; `-separated), isbn13, isbn10, publisher, year, pages, format, language, genres, series, series position, groups, on loan to, lent on, due on, notes, added. RFC 4180 quoting, UTF-8 with BOM for spreadsheet apps. Option "Include lending details" (off by default — borrower names are personal).
- **Files:** `src/services/backup/csv.ts`, `src/services/backup/exportCsv.ts`.
- **Acceptance:** quoting of commas, quotes and newlines; loan columns absent unless opted in.
- **Tests:** `src/services/backup/__tests__/csv.test.ts`, `exportCsv.test.ts`.
- **Delivered:** `csv.ts` reads and writes RFC 4180 (quotes, doubled quotes, line breaks in fields, CRLF/LF/CR, BOM) and detects comma, semicolon or tab delimiters. `exportCsv` writes one row per book from `bookExportRepo.listBooksForExport`: Title, Subtitle, Authors (`; `), ISBN-13, ISBN-10, Publisher, Year, Pages, Format, Language, Genres, Series, Series position, Groups, Notes, Added, with On loan to / Lent on / Due on only when "Include lending details" is on (off by default). UTF-8 with a BOM, CRLF. Text that a spreadsheet would run as a formula (starting with `=`, `+`, `-`, `@`, a tab or a carriage return) gets a leading apostrophe against CSV injection, which the import takes off again. Settings → Export as a spreadsheet shares `myshelf-books-YYYY-MM-DD.csv`.

### P08-05 CSV import with mapping and Goodreads preset

- **Description:** Import a CSV: detect delimiter and header; mapping screen matching columns to fields (auto-guessed; presets for MyShelf CSV and Goodreads library export — `Title`, `Author`, `Additional Authors`, `ISBN13` (strip `="…"` wrapping), `Publisher`, `Year Published`, `Original Publication Year`, `Number of Pages`, `Binding`, `Bookshelves`, `My Review` → notes). Preview first 10 rows with validation; import valid rows in one transaction; report skipped rows with reasons. Goodreads "Bookshelves" can optionally become user groups. Series parsed from titles like "Title (Series, #3)" with `seriesParser`. Optional "Fetch missing details" queues ISBNs into `pending_lookups`.
- **Files:** `src/services/backup/importCsv.ts`, `src/services/backup/csvPresets.ts`, `src/app/settings/import-csv.tsx`, `src/components/settings/ColumnMapper.tsx`.
- **Acceptance:** Goodreads fixture (20 rows incl. edge cases) imports 20 books with authors, series and groups; invalid rows reported, valid ones still imported.
- **Tests:** `src/services/backup/__tests__/importCsv.test.ts`, `csvPresets.test.ts`, `src/components/settings/__tests__/ColumnMapper.test.tsx`.
- **Partly delivered:** everything except "Fetch missing details". `readCsvTable` detects the delimiter, header and preset (Goodreads by its `Book Id` / `Exclusive Shelf` columns; MyShelf by its own export's headers); `csvPresets.ts` maps Goodreads' real columns (`ISBN`/`ISBN13` unwrapped from `="…"`, `Author` + comma-separated `Additional Authors`, `Binding` → format, `Year Published` falling back to `Original Publication Year`, `Date Added` kept as the date the book was added, `My Review` (HTML to text) + `Private Notes` → notes; notes that hold no HTML tag or entity, such as MyShelf's own export, are kept exactly as written, `Bookshelves` + `Exclusive Shelf` → groups, optional) and guesses other spreadsheets' columns. `planImport` (pure) turns rows into books: series come out of "Title (Series, #3)" with `parseSeriesFromTitle` and leave the title; invalid ISBNs, years and page counts are dropped with a warning; rows without a title, blank rows, rows repeated in the file and books already on the shelf (same ISBN-13, or same title and first author) are reported with a reason. `importPlannedBooks` adds the rest in one transaction. The screen (`ImportCsvScreen`, `ColumnMapper`) shows the preset, the used columns with an example value (ignored ones fold away), the first 10 rows as they will be imported and a report with skipped rows. **Real covers:** straight after the import the cover backfill runs over the new books (`drainCoverBackfill`, through the shared rate limiter) without holding up the import: one batch search finds the cover ids of every book with an ISBN, those books' covers come first (newest additions first), three at a time, and each shows on the Shelf as it arrives; the rest are looked up one by one. For the 20-book fixture that went from 73.5 s and 82 requests (measured against the live APIs, one book at a time) to 12.8 s and 22 requests; in the web app, from 64 s to about 10 s (see P02-16). The `csv-import-goodreads` journey waits until all 20 show a cover through the mocked APIs, and `live-goodreads-import-covers` until all 20 show a real Open Library cover at least 400 px tall through the real ones. The fixture `src/services/backup/__fixtures__/goodreads_library_export.csv` is hand-built with Goodreads' columns and quoting: 20 books, series in titles, three with several authors, a Kindle row with empty `=""` ISBNs, an ISBN-10-only row, a review with HTML and quotes, a two-line private note, accents. **Not built:** "Fetch missing details" (queueing ISBNs into `pending_lookups`): that queue is for books added offline, and each result waits for the user to pick a candidate to *add*, so queuing books already imported would offer them again as new books.

### P08-06 Backup reminder

- **Description:** If the library has ≥ 10 books and `backup.lastAt` is older than 30 days (or never), emit `backup-due`; Booky (*concerned*, gentle) "It's been a while since your last backup — save one now?" with action "Back up". At most weekly; snooze for 30 days.
- **Files:** `src/features/settings/backupReminder.ts`, tip in `src/components/booky/tips.ts`.
- **Acceptance:** rule fires/does not fire per table of states.
- **Tests:** `src/features/settings/__tests__/backupReminder.test.ts`.
- **Partly delivered:** the rule is pure (`backupReminderReason` in `src/features/settings/backupReminder.ts`, a table test of 15 states): 10 or more books, no backup in 30 days, at most once a week, "Later" snoozes 30 days, off when Booky is off or the `backup-due` tip is muted, and shown in Quiet mode too. "Never backed up" counts from the first book added, so a library imported all at once is not nagged on day one. `useBackupReminder` (in `SettingsWatchers`, at the root) checks on start and on return to the foreground and shows Booky (*concerned*): "It’s been a while since your last backup — save one now?" with **Back up** and **Later**, never over another tip, on the backup screens or during E2E fixture loading. **Not built:** the tip's entry in `src/components/booky/tips.ts`: that file and the tips engine belong to the Booky track (P07-02); the rule is written to be registered there as it is. *Update (Phase 07):* registered: the catalogue has the `backup-due` tip (same words, Back up and Later, Helpful and Quiet), and `useBackupReminder` now asks the rule on Booky's `app-foreground` and emits `backup-due`; `backup.reminderShownAt` is written only when the tip actually shows.

### P08-07 Preferences — done

- **Description:** Implement the preference rows: default loan length (7/14/21/28/42 days or custom), date display format (locale default / `12 Oct 2026` / `2026-10-12`), Google Books on/off, covers on mobile data, shelf defaults. Date formatting via `Intl.DateTimeFormat` in `src/domain/formatDate.ts`.
- **Files:** `src/app/settings/preferences.tsx`, `src/domain/formatDate.ts`.
- **Acceptance:** each preference observed by its consumer (e.g. new loan default due date).
- **Tests:** `src/domain/__tests__/formatDate.test.ts`, `src/__tests__/preferences.test.tsx`.
- **Delivered:** Settings → Shelf and lending (`PreferencesScreen`): sort (8 orders), sections, view, loan length (7/14/21/28/42 days or a custom 1–365) and date format, each a `SelectField` saved on choice (`SelectField` gained `allowNone` and `helperText`). `src/domain/formatDate.ts` has `formatDateAs` (`medium` "12 Oct 2026", the default and the app's old style; `iso`; `locale` via `Intl.DateTimeFormat`) and `formatDate`, which follows the setting (`setDateFormat`, applied by `SettingsWatchers` at start and on change), so every full date in the app follows it; the short loan stamps ("DUE 26 JUN") keep their design. Google Books and covers on mobile data are switches on the Settings tab. Consumers: the Shelf's saved sort, sections and view (`useShelfPrefs`), the lend sheet's due date (`useLend`), `formatDate` everywhere, `googleBooksEnabled` in the metadata service, and `coversOnMobileData` in the cover backfill (`coversAllowedNow`, expo-network: on mobile data with the switch off the backfill waits for Wi-Fi; the web build never holds covers back).

### P08-08 About and attribution — done

- **Description:** About screen: app name, version and build (`expo-constants`), MIT licence, link to the GitHub repo, "Book data from Open Library (Internet Archive) and Google Books", cover images credited to their source, third-party licences list (generated at build time by `scripts/gen-licences.mjs` from `package-lock.json` into `src/generated/licences.json`), privacy summary linking to `docs/privacy.md` on GitHub.
- **Files:** `src/app/settings/about.tsx`, `scripts/gen-licences.mjs`, `src/generated/licences.json`, `package.json` (script).
- **Acceptance:** licences list includes every production dependency; links open in the browser.
- **Tests:** `src/__tests__/about.test.tsx`; `scripts` check in CI that `licences.json` is current.
- **Delivered:** About MyShelf shows the version and build (`expo-constants`), "Book data from Open Library (Internet Archive) and Google Books", cover credits, the MIT licence with a link to https://github.com/asorichetti/MyShelf, a privacy summary and every production package with its licence (a summary by licence, and the full list behind a button). Links open the browser (`Linking.openURL`) and say so in their names. `scripts/gen-licences.mjs` writes `src/generated/licences.json` from `package-lock.json` (every non-dev package); `npm run licences:check` is part of `npm run check`, so CI fails when it is stale. The privacy link points at [ADR 0012](../adr/0012-local-only-data.md) until `docs/privacy.md` exists (P09-09). *Update (P09-09):* it now points at [`docs/privacy.md`](../privacy.md).

### P08-09 Clear all data — done

- **Description:** "Erase library" with a two-step confirmation (explain what will be lost, suggest backup first, then type "ERASE"). Deletes all rows (keeps settings unless "Also reset settings" is ticked), deletes cover files, clears caches.
- **Files:** `src/services/backup/eraseAll.ts`, `src/app/settings/erase.tsx`.
- **Acceptance:** everything gone; app returns to empty Shelf; onboarding not re-shown unless settings reset.
- **Tests:** `src/services/backup/__tests__/eraseAll.test.ts`.
- **Delivered:** Settings → Erase library, in two steps: what will be lost (with the counts), "Save a backup first", "Also reset my settings", Continue; then type ERASE (case-insensitive). `eraseAll` deletes every library row, the pending lookups, `cover_attempts`, `api_cache` and the restore safety copy in one transaction (`libraryRepo.eraseLibrary`), keeps settings (except the lists that name deleted ids) unless reset, then deletes the cover files (`deleteAllCovers`). The app returns to the empty Shelf with a snackbar. There is no onboarding yet, so nothing is re-shown.

### P08-10 Manage borrowers and pending lookups — done

- **Description:** Settings → Borrowers: list with loan counts, edit, delete (rules from P05-01). Settings → Pending lookups: list of queued ISBNs with retry and remove.
- **Files:** `src/app/settings/borrowers.tsx`, `src/app/settings/pending.tsx`.
- **Acceptance:** actions reflect in Loans tab and Shelf banner immediately.
- **Tests:** `src/__tests__/settings.borrowers.test.tsx`, `src/__tests__/settings.pending.test.tsx`.
- **Delivered:** Settings → Borrowers lists everyone with "has N books now · M loans in all", opens their page, edits them with the borrower page's own sheet (`BorrowerEditSheet`, now exported) and removes them with P05-01's rules (refused with an explanation while they have a book out; otherwise their returned-loan history goes too, after a confirmation). Settings → Pending lookups lists queued ISBNs with their state (waiting, retrying, gave up and why) and **Retry** / **Remove**; two new events, `pending-changed` and `pending-retry`, make the tab shell's queue reload or retry at once, so the Shelf's "waiting for details" banner follows immediately.

---

## Test ids to add to `selectors.json`

Added as planned, with a few changes the screens needed (the code is the reference: `src/testing/selectors.json`): `settings` gained `section`, `googleBooksNote`, `lastBackup`, `sort`, `groupBy`, `viewMode`, `loanLengthCustom` and `dateExample` (and has no `row` or `booky` yet: the Booky track adds its own); new groups `preferences`, `backup` (`export`, `contents`, `status`), `restore` (plus `file` and `undo`), `csvExport` (`includeLoans`, `export`, `status`), `csvImport` (plus `file`, `error`, `mapField`, `shelvesToggle`, `previewRow`, `skipped`, `done`), `erase` (plus `backupFirst`, `next`), `about` (plus `privacyLink`, `attribution`, `licencesToggle`, `licenceRow`), `borrowers` and `pendingList` (the Settings lists; `pending` was already the Shelf banner's group). Every screen group has a `back`.

## Auto test suite journeys

All in suite `p08` (`npm run -s autotest -- journey --suite p08`), run with `--ux-gates fail`; files go out through the browser's download (Playwright's `download` event) and come back through its file chooser (`filechooser`). They navigate inside the app rather than reloading, so a fixed "today" holds.

| Journey | Suite | Steps |
|---|---|---|
| `settings-overview` | `p08` | Settings tab: the five sections in order, every row a named link or switch ≥ 48 px, switches report `aria-checked`, Borrowers counts 2 people |
| `backup-roundtrip` | `p08` | fixture `demo`: save a backup (download) → erase → restore it with Replace → the Shelf's 12 rows are identical, and a second backup has identical rows in every table (a cover the backfill found for The Farthest Shore is allowed) |
| `restore-undo` | `p08` | fixture `demo`: restore the schema 1 fixture (brought forward through the migrations in the browser) → its 3 books, newest first as its settings say → Undo restore → the 12 demo books |
| `restore-corrupt-file` | `p08` | a cut-off backup and a foreign JSON file each show `restore.error` (role alert); still 12 books |
| `csv-import-goodreads` | `p08` | fixture `empty`, Google Books off: the Goodreads fixture → Goodreads preset chosen by itself → preview of 10 rows, "20 books will be added" → import → "Imported 20 books" with shelves as groups → 20 books on the Shelf; the cover backfill gives The Final Empire and The Name of the Wind real covers, then every one of the 20 shows a cover in the covers grid (mocked Open Library: the batch search, and the title search for The Colour of Magic) |
| `restore-covers-backfill` | `p08` | fixture `empty`: restore `backup-phone-covers.json` (20 books whose covers stayed on the old phone) with Replace → See your shelf → every one of the 20 shows a cover in the covers grid (mocked Open Library) |
| `csv-export` | `p08` | the downloaded CSV has a BOM, the header and 12 rows, no loan columns; with lending details on, Dune is on loan to Sam |
| `erase-library` | `p08` | explain step (12 books, backup first, reset checkbox) → Erase disabled until ERASE is typed → the empty Shelf; the 14-day loan length is kept |
| `preferences-persist` | `p08` | newest first, 14-day loans, ISO dates, Google Books off → reload → all kept; the Shelf opens newest first; the lend sheet offers a due date 14 days on, written in ISO |
| `about-page` | `p08` | version and build, credits, MIT licence, the GitHub link opens the repo, hundreds of packages listed |
| `settings-borrowers-pending` | `p08` | Borrowers lists Sam and Priya; removing Priya is refused; renaming Sam shows on the Loans tab; Pending lookups is empty |
| `live-goodreads-import-covers` | `live` | the Goodreads import against the real Open Library and real covers: waits (up to 90 s) until every one of the 20 books shows a real Open Library cover at least 400 px tall, and asserts it for each (a book proven to have no Open Library cover would be listed with its reason; none today); logs the time taken (about 10 s); screenshots of the whole covers grid |
| `live-restore-covers` | `live` | the same for a restore of `backup-phone-covers.json`: every one of the 20 books gets a real Open Library cover at least 400 px tall |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/backup-share.yaml` | export opens the Android share sheet (assert sheet visible, then back) |
| `.maestro/restore-from-file.yaml` | manual-assisted (tagged `manual`): pick a backup from Downloads via the system picker, restore |

Written as one flow, `backup-restore.yaml`, which is not manual: `scripts/maestro-suite.sh` pushes a backup into Downloads, and the flow picks it in the system document picker. `csv-import-goodreads.yaml` does the same for the Goodreads export. Both pass on an Android 16 emulator ([`docs/device-testing.md`](../device-testing.md)).

## Risks

| Risk | Mitigation |
|---|---|
| Restoring a bad file destroys data | validate first; single transaction; suggest export before replace |
| Schema drift between backup and app | `schemaVersion` + forward migration through a temp DB; fixture per old version |
| CSV encodings/quirks | BOM handling, delimiter detection, Goodreads `="…"` stripping, tests |
| Personal data in exports | loans opt-in for CSV; clear wording on what the backup contains |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + lint + typecheck + Jest
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- Backup → erase → restore returns an identical library on Android and web.
- Goodreads CSV import works end to end.
- All P08 journeys pass with `--ux-gates fail`; Maestro flows pass.
- Regression gate green in CI.
