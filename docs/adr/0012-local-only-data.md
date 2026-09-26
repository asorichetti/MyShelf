# 0012. Local-only data, no accounts; backup via export/import

- Status: Accepted
- Date: 2026-09-25

## Context

The app must be free to run, so there is no server to host accounts or sync. A personal book catalogue and a list of who borrowed what are private data.

## Decision

- All data stays on the device in SQLite. No accounts, analytics, crash-reporting services or ads.
- The only network traffic is metadata/cover lookups to Open Library and Google Books, containing ISBNs or search text — never the user's library, notes or borrower names.
- Backup and device migration are handled by **export/import** (JSON full backup, CSV books export/import) through the Android share sheet and file picker (Phase 08).

## Consequences

- Simple, private, zero cost; the privacy policy (P09-09) is short.
- Users can lose data if they lose the phone without a backup; Booky reminds them to export periodically (P08-06).
- Adding sync later would need a new ADR.
