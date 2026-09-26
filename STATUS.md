# MyShelf — Status

Checklist of every task card in [`docs/plan/`](docs/plan/). Tick a card (`[x]`) in the same pull request that completes it, and only when it meets the [definition of done](PLAN.md#12-definition-of-done). Cards are ticked only once the work is on `main`.

On `main`: the scaffold (P00-01 to P00-07), the design system, Booky, tabs, database layer and domain (P00-08 to P00-14), the auto test suite (P00-15 to P00-17), CI (P00-19), linting (P00-20), and the follow-ups P00-21 to P00-29 (`--serve`, commit-message and all-journeys CI, touch targets, gate self-tests, Booky and theme journeys). Still open in Phase 00: Maestro (P00-18, needs an Android emulator). Phase 01 (library core) is complete.

## Summary

| Phase | Name | Done |
|---|---|---|
| [Phase 00](docs/plan/phase-00-foundation.md) | Foundation | 29 / 30 |
| [Phase 01](docs/plan/phase-01-library-core.md) | Library core: CRUD and book detail | 12 / 12 |
| [Phase 02](docs/plan/phase-02-metadata-providers.md) | Metadata providers | 16 / 16 |
| [Phase 03](docs/plan/phase-03-scanning.md) | Scanning: barcode, OCR and edition picker | 10 / 14 |
| [Phase 04](docs/plan/phase-04-series.md) | Series | 8 / 8 |
| [Phase 05](docs/plan/phase-05-lending.md) | Lending | 8 / 10 |
| [Phase 06](docs/plan/phase-06-grouping-and-shelf-views.md) | Grouping and shelf views | 9 / 11 |
| [Phase 07](docs/plan/phase-07-booky-assistant.md) | Booky assistant | 0 / 9 |
| [Phase 08](docs/plan/phase-08-settings-backup.md) | Settings, backup, export and import | 0 / 10 |
| [Phase 09](docs/plan/phase-09-polish-a11y-release.md) | Polish, accessibility and release | 0 / 12 |
| **Total** | | **92 / 132** |

## Phase 00 — Foundation

[Phase document](docs/plan/phase-00-foundation.md)

- [x] P00-01 Scaffold Expo TypeScript app
- [x] P00-02 Expo Router with routes in `src/app`
- [x] P00-03 Web target
- [x] P00-04 Jest with jest-expo and Testing Library
- [x] P00-05 Selector contract and generator
- [x] P00-06 Public GitHub repository
- [x] P00-07 Commit-msg hook
- [x] P00-08 Design tokens and fonts
- [x] P00-09 UI primitives
- [x] P00-10 Booky component, bubble and hook
- [x] P00-11 Bottom tabs and placeholder screens
- [x] P00-12 `Db` interface and adapters
- [x] P00-13 Migration runner and initial schema
- [x] P00-14 Domain models and base repositories
- [x] P00-15 Auto test suite core
- [x] P00-16 Auto test suite UX gates
- [x] P00-17 Auto test suite commands, journeys and package scripts
- [ ] P00-18 Maestro setup
- [x] P00-19 GitHub Actions CI
- [x] P00-20 Linting
- [x] P00-21 `--serve <dir>` for the exported web build
- [x] P00-22 CI check of commit messages
- [x] P00-23 CI runs every journey
- [x] P00-24 Re-enable the temporary render rules and require the design tokens
- [x] P00-25 Tab journeys
- [x] P00-26 App-owned not-found screen
- [x] P00-27 Touch-target rule in the a11y gate
- [x] P00-28 Automated gate self-tests
- [x] P00-29 Booky and theme journeys
- [x] P00-30 Remaining UI primitives

## Phase 01 — Library core: CRUD and book detail

[Phase document](docs/plan/phase-01-library-core.md)

- [x] P01-01 E2E fixture loader
- [x] P01-02 Books repository: list, search and sort queries
- [x] P01-03 Shelf screen (list of catalogue cards)
- [x] P01-04 Shelf search and sort controls
- [x] P01-05 Book form model and validation
- [x] P01-06 Book detail screen
- [x] P01-07 Add and edit book form
- [x] P01-08 Authors editor
- [x] P01-09 Genres editor
- [x] P01-10 Cover image and generated fallback
- [x] P01-11 Delete book with confirmation and undo
- [x] P01-12 Library change events and screen refresh

## Phase 02 — Metadata providers

[Phase document](docs/plan/phase-02-metadata-providers.md)

- [x] P02-01 HTTP client wrapper
- [x] P02-02 Provider interface and candidate model
- [x] P02-03 Open Library: ISBN lookup
- [x] P02-04 Open Library: search and work editions
- [x] P02-05 Google Books provider
- [x] P02-06 Merge and rank candidates
- [x] P02-07 Genre normaliser
- [x] P02-08 Series extraction
- [x] P02-09 Response cache and cover download
- [x] P02-10 Offline handling and pending lookups
- [x] P02-11 "Look up by ISBN" and "Search online" in the add flow
- [x] P02-12 Refresh details for an existing book
- [x] P02-13 Auto test suite API mocking and recorded fixtures
- [x] P02-14 Cover resolution chain
- [x] P02-15 Store the best cover when saving from a lookup
- [x] P02-16 Cover backfill with backoff

## Phase 03 — Scanning: barcode, OCR and edition picker

[Phase document](docs/plan/phase-03-scanning.md)

- [ ] P03-01 Development and E2E builds
- [x] P03-02 Camera permission flow
- [x] P03-03 Barcode scanner
- [x] P03-04 Scan result flow for barcodes
- [ ] P03-05 Cover capture and ML Kit OCR
- [ ] P03-06 OCR text → search queries
- [x] P03-07 Web stub and E2E scan injection
- [x] P03-08 Edition picker
- [x] P03-09 Save from candidate
- [x] P03-10 Duplicate detection
- [x] P03-11 Manual fallback with prefill
- [x] P03-12 Continuous scanning mode
- [x] P03-13 Scan screen polish and help
- [ ] P03-14 Use the cover photo when no online cover exists

## Phase 04 — Series

[Phase document](docs/plan/phase-04-series.md)

- [x] P04-01 Series repository
- [x] P04-02 Series picker in the book form
- [x] P04-03 Confirm detected series on save
- [x] P04-04 Series list screen
- [x] P04-05 Series detail screen
- [x] P04-06 Series on book detail
- [x] P04-07 Series gap tip
- [x] P04-08 Series completion celebration

## Phase 05 — Lending

[Phase document](docs/plan/phase-05-lending.md)

- [x] P05-01 Borrowers repository and picker
- [x] P05-02 Loan domain rules
- [x] P05-03 Lend flow
- [ ] P05-04 Return flow
- [x] P05-05 Loans tab
- [x] P05-06 Borrower detail
- [x] P05-07 Loan history on book detail
- [ ] P05-08 Due-date reminders (local notifications)
- [x] P05-09 Loan badges on the Shelf
- [x] P05-10 Overdue Booky nudge

## Phase 06 — Grouping and shelf views

[Phase document](docs/plan/phase-06-grouping-and-shelf-views.md)

- [x] P06-01 Shelf group-by
- [x] P06-02 Genre management
- [x] P06-03 Author browse and detail
- [x] P06-04 User groups repository
- [x] P06-05 Groups tab
- [ ] P06-06 Group detail and ordering
- [x] P06-07 Multi-select and add to group
- [ ] P06-08 Shelf display modes
- [x] P06-09 Persist shelf preferences
- [x] P06-10 Shelf filters
- [x] P06-11 Browse hub

## Phase 07 — Booky assistant

[Phase document](docs/plan/phase-07-booky-assistant.md)

- [ ] P07-01 Tip catalogue
- [ ] P07-02 Trigger engine
- [ ] P07-03 Onboarding
- [ ] P07-04 Empty states audit
- [ ] P07-05 Contextual help
- [ ] P07-06 Dismissal, muting and Booky modes
- [ ] P07-07 Placement and layering
- [ ] P07-08 Motion and reduce-motion
- [ ] P07-09 Booky accessibility pass

## Phase 08 — Settings, backup, export and import

[Phase document](docs/plan/phase-08-settings-backup.md)

- [ ] P08-01 Settings screen
- [ ] P08-02 JSON backup export
- [ ] P08-03 JSON backup import (restore)
- [ ] P08-04 CSV export
- [ ] P08-05 CSV import with mapping and Goodreads preset
- [ ] P08-06 Backup reminder
- [ ] P08-07 Preferences
- [ ] P08-08 About and attribution
- [ ] P08-09 Clear all data
- [ ] P08-10 Manage borrowers and pending lookups

## Phase 09 — Polish, accessibility and release

[Phase document](docs/plan/phase-09-polish-a11y-release.md)

- [ ] P09-01 Accessibility audit and fixes
- [ ] P09-02 Dark theme
- [ ] P09-03 Performance and full-text search
- [ ] P09-04 Error boundaries and resilience
- [ ] P09-05 App icon, splash and store graphics
- [ ] P09-06 Release build configuration
- [ ] P09-07 CI release workflow
- [ ] P09-08 Screenshots and README media
- [ ] P09-09 Privacy policy
- [ ] P09-10 Final device regression
- [ ] P09-11 Localisation readiness
- [ ] P09-12 v1.0 release
