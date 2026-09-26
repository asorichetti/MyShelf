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

### P08-01 Settings screen

- **Description:** Settings tab as grouped sections: **Library** (default sort, group by, view mode, default loan length), **Booky** (→ P07-06 screen), **Lookups** (Google Books on/off, download covers on mobile data on/off, pending lookups list with retry/remove), **Lending** (reminders toggle from P05-08, manage borrowers), **Backup & data** (export, import, CSV, clear data), **About**. Typed settings access with defaults in `src/db/repositories/settings.ts`.
- **Files:** `src/app/(tabs)/settings.tsx`, `src/app/settings/*.tsx`, `src/components/settings/SettingsRow.tsx`, `src/features/settings/useSettings.ts`.
- **Acceptance:** every row has a label, value and accessible role (switch/button/link); changes apply immediately and persist.
- **Tests:** `src/features/settings/__tests__/useSettings.test.tsx`, `src/__tests__/settingsTab.test.tsx`.

### P08-02 JSON backup export

- **Description:** `exportBackup(db)` → `{ format: 'myshelf-backup', formatVersion: 1, schemaVersion, appVersion, exportedAt, tables: { books: [...], authors: [...], ... } }` (all tables except `api_cache`; covers optional as base64 in a zip is **out of scope** — covers are re-downloadable). Write to a cache file `myshelf-backup-YYYY-MM-DD.json` with `expo-file-system` and open the share sheet with `expo-sharing` (install both with `npx expo install`). On web, trigger a download. Record `backup.lastAt` in settings.
- **Files:** `src/services/backup/exportBackup.ts`, `src/services/backup/shareFile.{native,web}.ts`, `src/app/settings/backup.tsx`.
- **Acceptance:** export of `demo` round-trips through import (P08-03) to an identical database (row-by-row compare).
- **Tests:** `src/services/backup/__tests__/exportBackup.test.ts` (node env).

### P08-03 JSON backup import (restore)

- **Description:** Pick a file (`expo-document-picker`, installed with `npx expo install expo-document-picker`; `<input type=file>` on web), parse and validate (format name, versions, required columns, referential integrity) with clear error messages. If `schemaVersion` < current, load into a temporary in-memory DB at that version and run migrations forward before copying. Modes: **Replace everything** (typed confirmation "REPLACE") or **Merge** (skip books whose `isbn13 + title` already exist; remap ids). Runs in one transaction; on failure nothing changes.
- **Files:** `src/services/backup/importBackup.ts`, `src/services/backup/validateBackup.ts`, `src/services/backup/pickFile.{native,web}.ts`, `src/app/settings/restore.tsx`.
- **Acceptance:** corrupt file → friendly error, DB untouched; old-version backup restored correctly; merge remaps foreign keys.
- **Tests:** `src/services/backup/__tests__/importBackup.test.ts`, `validateBackup.test.ts` with fixture backups (current, older, corrupt, tampered ids).

### P08-04 CSV export

- **Description:** Flat CSV of books: title, subtitle, authors (`; `-separated), isbn13, isbn10, publisher, year, pages, format, language, genres, series, series position, groups, on loan to, lent on, due on, notes, added. RFC 4180 quoting, UTF-8 with BOM for spreadsheet apps. Option "Include lending details" (off by default — borrower names are personal).
- **Files:** `src/services/backup/csv.ts`, `src/services/backup/exportCsv.ts`.
- **Acceptance:** quoting of commas, quotes and newlines; loan columns absent unless opted in.
- **Tests:** `src/services/backup/__tests__/csv.test.ts`, `exportCsv.test.ts`.

### P08-05 CSV import with mapping and Goodreads preset

- **Description:** Import a CSV: detect delimiter and header; mapping screen matching columns to fields (auto-guessed; presets for MyShelf CSV and Goodreads library export — `Title`, `Author`, `Additional Authors`, `ISBN13` (strip `="…"` wrapping), `Publisher`, `Year Published`, `Original Publication Year`, `Number of Pages`, `Binding`, `Bookshelves`, `My Review` → notes). Preview first 10 rows with validation; import valid rows in one transaction; report skipped rows with reasons. Goodreads "Bookshelves" can optionally become user groups. Series parsed from titles like "Title (Series, #3)" with `seriesParser`. Optional "Fetch missing details" queues ISBNs into `pending_lookups`.
- **Files:** `src/services/backup/importCsv.ts`, `src/services/backup/csvPresets.ts`, `src/app/settings/import-csv.tsx`, `src/components/settings/ColumnMapper.tsx`.
- **Acceptance:** Goodreads fixture (20 rows incl. edge cases) imports 20 books with authors, series and groups; invalid rows reported, valid ones still imported.
- **Tests:** `src/services/backup/__tests__/importCsv.test.ts`, `csvPresets.test.ts`, `src/components/settings/__tests__/ColumnMapper.test.tsx`.

### P08-06 Backup reminder

- **Description:** If the library has ≥ 10 books and `backup.lastAt` is older than 30 days (or never), emit `backup-due`; Booky (*concerned*, gentle) "It's been a while since your last backup — save one now?" with action "Back up". At most weekly; snooze for 30 days.
- **Files:** `src/features/settings/backupReminder.ts`, tip in `src/components/booky/tips.ts`.
- **Acceptance:** rule fires/does not fire per table of states.
- **Tests:** `src/features/settings/__tests__/backupReminder.test.ts`.

### P08-07 Preferences

- **Description:** Implement the preference rows: default loan length (7/14/21/28/42 days or custom), date display format (locale default / `12 Oct 2026` / `2026-10-12`), Google Books on/off, covers on mobile data, shelf defaults. Date formatting via `Intl.DateTimeFormat` in `src/domain/formatDate.ts`.
- **Files:** `src/app/settings/preferences.tsx`, `src/domain/formatDate.ts`.
- **Acceptance:** each preference observed by its consumer (e.g. new loan default due date).
- **Tests:** `src/domain/__tests__/formatDate.test.ts`, `src/__tests__/preferences.test.tsx`.

### P08-08 About and attribution

- **Description:** About screen: app name, version and build (`expo-constants`), MIT licence, link to the GitHub repo, "Book data from Open Library (Internet Archive) and Google Books", cover images credited to their source, third-party licences list (generated at build time by `scripts/gen-licences.mjs` from `package-lock.json` into `src/generated/licences.json`), privacy summary linking to `docs/privacy.md` on GitHub.
- **Files:** `src/app/settings/about.tsx`, `scripts/gen-licences.mjs`, `src/generated/licences.json`, `package.json` (script).
- **Acceptance:** licences list includes every production dependency; links open in the browser.
- **Tests:** `src/__tests__/about.test.tsx`; `scripts` check in CI that `licences.json` is current.

### P08-09 Clear all data

- **Description:** "Erase library" with a two-step confirmation (explain what will be lost, suggest backup first, then type "ERASE"). Deletes all rows (keeps settings unless "Also reset settings" is ticked), deletes cover files, clears caches.
- **Files:** `src/services/backup/eraseAll.ts`, `src/app/settings/erase.tsx`.
- **Acceptance:** everything gone; app returns to empty Shelf; onboarding not re-shown unless settings reset.
- **Tests:** `src/services/backup/__tests__/eraseAll.test.ts`.

### P08-10 Manage borrowers and pending lookups

- **Description:** Settings → Borrowers: list with loan counts, edit, delete (rules from P05-01). Settings → Pending lookups: list of queued ISBNs with retry and remove.
- **Files:** `src/app/settings/borrowers.tsx`, `src/app/settings/pending.tsx`.
- **Acceptance:** actions reflect in Loans tab and Shelf banner immediately.
- **Tests:** `src/__tests__/settings.borrowers.test.tsx`, `src/__tests__/settings.pending.test.tsx`.

---

## Test ids to add to `selectors.json`

```json
{
  "settings": {
    "root": "settings-root", "title": "settings-title", "row": "settings-row",
    "exportBackup": "settings-export-backup", "importBackup": "settings-import-backup",
    "exportCsv": "settings-export-csv", "importCsv": "settings-import-csv", "erase": "settings-erase",
    "booky": "settings-booky", "about": "settings-about", "borrowers": "settings-borrowers",
    "pending": "settings-pending", "preferences": "settings-preferences",
    "googleBooksToggle": "settings-google-books-toggle", "coversOnDataToggle": "settings-covers-on-data-toggle",
    "loanLength": "settings-loan-length", "dateFormat": "settings-date-format"
  },
  "restore": { "root": "restore-root", "pick": "restore-pick", "modeReplace": "restore-mode-replace", "modeMerge": "restore-mode-merge", "confirmInput": "restore-confirm-input", "confirm": "restore-confirm", "error": "restore-error", "summary": "restore-summary" },
  "csvImport": { "root": "csv-import-root", "pick": "csv-import-pick", "preset": "csv-import-preset", "mapping": "csv-import-mapping", "preview": "csv-import-preview", "confirm": "csv-import-confirm", "report": "csv-import-report" },
  "erase": { "root": "erase-root", "resetSettings": "erase-reset-settings", "confirmInput": "erase-confirm-input", "confirm": "erase-confirm" },
  "about": { "root": "about-root", "version": "about-version", "licences": "about-licences", "repoLink": "about-repo-link" }
}
```

(`settings.root`/`settings.title` exist from P00-11 — extend the group.)

## Auto test suite journeys

Each journey is added by the card that builds its screen. Suite `core` journeys run in `smoke` (CI and the regression gate); the rest use suite `p08` (`auto-test-suite journey --suite p08`).

| Journey | Suite | Steps |
|---|---|---|
| `settings-overview` | `core` | Settings tab → every section row visible; a11y gate |
| `backup-roundtrip` | `core` | fixture `demo`; export (web download captured by Playwright) → erase → restore replace with the downloaded file → 12 books, loans intact |
| `restore-corrupt-file` | `p08` | upload corrupt JSON → `restore.error`, library unchanged |
| `csv-import-goodreads` | `p08` | fixture `empty`; upload Goodreads fixture CSV → preset auto-selected → preview → import → report 20 imported |
| `csv-export` | `p08` | export CSV → downloaded file has header and 12 rows (checked by the journey) |
| `erase-library` | `p08` | erase with typed confirmation → empty shelf |
| `about-page` | `p08` | version shown, licences list non-empty |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/backup-share.yaml` | export opens the Android share sheet (assert sheet visible, then back) |
| `.maestro/restore-from-file.yaml` | manual-assisted (tagged `manual`): pick a backup from Downloads via the system picker, restore |

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
npm run check                    # selectors:check + typecheck + Jest (+ lint once P00-20 lands)
npm run -s autotest:smoke        # builds the auto test suite and runs `smoke` (core suite, gates fail)
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- Backup → erase → restore returns an identical library on Android and web.
- Goodreads CSV import works end to end.
- All P08 journeys pass with `--ux-gates fail`; Maestro flows pass.
- Regression gate green in CI.
