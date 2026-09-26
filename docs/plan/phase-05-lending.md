# Phase 05 — Lending

## Goal

Never lose a book to a friend again. The user records who borrowed a book and when (optionally a due date), sees everything that is out on the Loans tab with library-style due-date stamps, marks books returned, and gets a gentle reminder when something is overdue.

## Scope

- Borrowers (name + optional free-text contact) with picker and create-inline.
- Lend and return flows from book detail; one open loan per book.
- Loans tab: On loan, Overdue, History.
- Borrower detail with current and past loans.
- Overdue logic, loan badges on the Shelf, optional local reminders.

## Out of scope

- Contacts-app integration (privacy and permissions not worth it for v1; contact is free text).
- Sending messages to borrowers (the app never sends anything).

## Prerequisites

- Phase 01. `loans` and `borrowers` tables and base repositories from P00-13/P00-14 (partial unique index on open loans).

---

## Task cards

### P05-01 Borrowers repository and picker — done

- **Description:** Borrower queries in `loansRepo` (`src/db/repositories/loans.ts`), which already has `createBorrower`, `getBorrower`, `listBorrowers`, `updateBorrower` and `deleteBorrower` (refused with `BorrowerHasLoansError` while the borrower has any loans, because `loans.borrower_id` is `ON DELETE RESTRICT`). Add `searchBorrowers(db, prefix)`, `listBorrowersWithStats(db)` (open loans count, total loans) and `deleteReturnedLoansForBorrower(db, id)` so the UI can offer to clear returned history before deleting. `BorrowerPicker`: search field, recent borrowers first, "Add 'Sam'" inline create, optional contact field ("phone, email or where they live — just for you").
- **Files:** `src/db/repositories/loans.ts`, `src/components/loans/BorrowerPicker.tsx`.
- **Acceptance:** case-insensitive de-duplication suggestion ("Sam already exists — use them?"); delete rules enforced.
- **Tests:** `src/db/repositories/__tests__/borrowers.test.ts`, `src/components/loans/__tests__/BorrowerPicker.test.tsx`.
- **Delivered:** the repository part is in `loansRepo`: `searchBorrowers(db, prefix)` (the name or any word of it starts with the prefix, ignoring case and accents; most recent borrower first; a blank prefix lists everyone), `listBorrowersWithStats(db)` (`BorrowerWithStats`: `openLoans`, `totalLoans`, `lastLentOn`, most recent first, then A-Z), `findBorrowerByName(db, name)` for the "Sam already exists — use them?" suggestion (case, accents and punctuation ignored) and `deleteReturnedLoansForBorrower(db, id)`. `deleteBorrower` still throws `BorrowerHasLoansError` while any loan remains. Blank contact text is stored as null. The loan writes now check dates with the P05-02 rules before touching the database (`LoanValidationError`; the CHECK constraints stay as a backstop), and `lendBook` turns a foreign-key failure into `BorrowerNotFoundError` or `BookNotFoundError`. The picker: `BorrowerPicker` (`src/components/loans/BorrowerPicker.tsx`) takes `search` and `findByName` functions (the lend sheet passes `loansRepo.searchBorrowers` / `findBorrowerByName` through `useLend`), so it stays free of the database. It lists up to six borrowers, most recent first, each a 48 dp button with "Has 1 book now" / "Borrowed 3 times before"; typing narrows them after a 150 ms pause. "Add “Sam”" is always offered for a typed name: if `findBorrowerByName` finds one (case, accents and punctuation ignored) an alert asks "Sam already exists — use them?" with "Use Sam" and "Add someone new". The choice is a `BorrowerChoice` (`existing` or `new` with name and contact); a new borrower is only written when the loan is saved, in the same transaction, so a cancelled sheet leaves no stray borrower. A new borrower gets the optional contact field ("Phone, email or where they live — just for you."). Test ids: `lend.borrowerSearch`, `borrowerOption`, `borrowerCreate`, `borrowerExisting`, `borrowerUseExisting`, `borrowerAddAnyway`, `borrowerSelected`, `borrowerChange`, `borrowerContact`.

### P05-02 Loan domain rules — done

- **Description:** Pure helpers in `src/domain/loans.ts`: `loanStatus(loan, today)` → `on-loan | due-soon (≤ 3 days) | overdue | returned`; `daysOverdue`; `defaultDueDate(lentOn, settings.loanDays)` (default 28 days, configurable in P08-07); validation (`due_on ≥ lent_on`, `returned_on ≥ lent_on`, no future `lent_on`). All dates are local `YYYY-MM-DD` strings; "today" comes from the injectable clock (P01-01).
- **Files:** `src/domain/loans.ts`, `src/domain/dates.ts`.
- **Acceptance:** boundary cases (due today = due-soon, not overdue; month/year rollovers; leap day).
- **Tests:** `src/domain/__tests__/loans.test.ts`.
- **Delivered:** `src/domain/loans.ts` has `loanStatus(loan, today)` and `loanStatusAt(loan, now)` (due-soon covers the three days before the due date and the due date itself), `isOverdue` (moved here from `loan.ts`), `daysOverdue`, `daysUntilDue`, `daysReturnedLate`, `defaultDueDate(lentOn, loanDays)` with `normaliseLoanDays` (a whole number from 1 to 3650, else 28), and `validateLoanDates(input, today?)` returning `{ field, code }` issues (`invalid-date`, `lent-in-future`, `due-before-lent`, `returned-before-lent`, `returned-in-future`), plus `assertValidLoanDates` / `LoanValidationError`. A past due date and a return after the due date are allowed. The setting `loanDays` (default 28) is added to `AppSettings` for P08-07 to expose. `src/domain/dates.ts` needed no change: `daysBetween` rounds, so 23- and 25-hour days count as one. Jest sandboxes `process.env`, so the timezone and DST tests run the domain module in child Node processes with `TZ` set (New York, London, Kolkata, Lord Howe, São Paulo's midnight DST gap and others).

### P05-03 Lend flow — done

- **Description:** Book detail "Lend" button → sheet: borrower picker, lent-on date (default today), due date (default from settings; "No due date" option), note. Save calls `loansRepo.lendBook(db, …)`; on `BookAlreadyOnLoanError` show the current loan instead. Snackbar "Lent to Sam". Book detail then shows a `Stamp` ("ON LOAN · SAM · DUE 12 OCT") and a "Mark returned" button instead of "Lend".
- **Files:** `src/components/loans/LendSheet.tsx`, `src/features/loans/useLend.ts`, `src/components/ui/DateField.tsx`, `src/app/book/[id].tsx`.
- **Acceptance:** cannot create a second open loan (UI and DB); dates validated; accessible date field with typed input fallback.
- **Tests:** `src/features/loans/__tests__/useLend.test.tsx`, `src/components/loans/__tests__/LendSheet.test.tsx`, `src/components/ui/__tests__/DateField.test.tsx`.
- **Delivered:** the loan section of book detail is `BookLoanSection` (`src/features/loans/BookLoanSection.tsx`), added to `BookDetailScreen` in place of its inline loan status; `src/app/book/[id].tsx` stays a one-line re-export. `LendSheet` (`src/components/loans/`) is a `Sheet` (new `src/components/ui/Sheet.tsx`: a modal `role="dialog"` titled by an h2, scrolling body, pinned actions) with the borrower picker, "Lent on" (today), "Due back" (`defaultDueDate(lentOn, loanDays)`; it follows the lent date until edited by hand), a "No due date" checkbox and a note. Save checks `validateLoanDates(input, today())` first (errors by the field and in an alert summary), then `lendToBorrower` (`src/features/loans/useLend.ts`) creates a new borrower and calls `loansRepo.lendBook` in one transaction. `BookAlreadyOnLoanError` closes the sheet with "“Dune” is already on loan to Priya." and the page reloads to show that loan; a borrower or book deleted meanwhile is reported in the sheet. Success: snackbar "Lent to Sam", `loans-changed`, and the stamp "ON LOAN · SAM · DUE 12 OCT" (`LoanStamp`, read out as "On loan · Sam. Due back on 12 Oct 2026") with "Mark returned" in place of "Lend". Stamp wording and tone come from `loanStamp()` in the new `src/domain/loanStamp.ts`. **`DateField`** (`src/components/ui/`) holds `YYYY-MM-DD` (or the raw text while it is not a date, so validation reports `invalid-date`): on Android and iOS a typed field that reads "12/10/2026", "12-10-26" or "12 Oct 2026" (`parseTypedDate`, `src/domain/dateInput.ts`) and repeats the date in words under it, plus on Android a button that opens the system calendar (`@react-native-community/datetimepicker`'s `DateTimePickerAndroid`, `openDatePicker.android.ts`); on web (`DateField.web.tsx`) the browser's `<input type="date">`, labelled, typeable and with its own accessible calendar.

### P05-04 Return flow

- **Description:** "Mark returned" on book detail, loans list rows (swipe action + button) and borrower detail. Confirm sheet with returned-on date (default today). Stamp changes to "RETURNED" briefly, Booky (*happy*) "Welcome home, 'Dune'!". Undo via snackbar.
- **Files:** `src/features/loans/useReturn.ts`, `src/components/loans/ReturnSheet.tsx`.
- **Acceptance:** returned loan moves to History; undo re-opens it (only if no other open loan exists).
- **Tests:** `src/features/loans/__tests__/useReturn.test.tsx`, `src/db/repositories/__tests__/loans.return.test.ts`.
- **Partly delivered:** "Mark returned" is on book detail, on each open Loans tab row and on borrower detail; all three open the same `ReturnSheet` through `useReturnFlow()` (`src/features/loans/ReturnFlow.tsx`), with "Came back on" (today; not before the lent date, not in the future). `useReturn` saves it, emits `loans-changed` and shows "Welcome home, “Dune”!" with Undo; Undo calls the new `loansRepo.reopenLoan`, which refuses (`BookAlreadyOnLoanError`) if the book has gone out again, and the snackbar then says so. On book detail a RETURNED stamp with happy Booky and the welcome line show for five seconds (`WELCOME_HOME_MS`) in a polite live region. The pure parts are `markReturned` and `undoReturn`. **Not built:** the swipe action on loan rows (there is no gesture library in the app yet); rows have a visible "Mark returned" button instead.

### P05-05 Loans tab

- **Description:** Loans tab with segmented sections: **Out now** (sorted by due date, overdue first), **History** (returned, newest first). Each row is a library-card-pocket style card: cover thumb, title, borrower, lent date, due stamp in `warn`/`danger`/`success` tone. Filters: borrower. Counts in the tab badge (overdue count). Empty state: Booky *sleepy* "Every book is home. Lovely."
- **Files:** `src/features/loans/LoansScreen.tsx`, `src/features/loans/useLoans.ts`, `src/components/loans/LoanRow.tsx`, `src/db/repositories/loans.ts` (`listOpenLoans` and `listOverdueLoans` exist; add `listReturnedLoans`).
- **Acceptance:** overdue row shows "OVERDUE · 3 DAYS" stamp; tab badge equals overdue count; colour is never the only cue (text in stamp).
- **Tests:** `src/features/loans/__tests__/useLoans.test.tsx`, `src/components/loans/__tests__/LoanRow.test.tsx`, `src/__tests__/loansTab.test.tsx`.

### P05-06 Borrower detail

- **Description:** Route `src/app/borrower/[id].tsx`: name, contact, "Currently has" list, "Has borrowed before" list, edit/delete. Reachable from loan rows and from Settings → Borrowers (P08-01).
- **Files:** `src/app/borrower/[id].tsx`, `src/features/loans/useBorrower.ts`.
- **Acceptance:** lists correct for `demo`; delete blocked message when books are out.
- **Tests:** `src/__tests__/borrowerDetail.test.tsx`.

### P05-07 Loan history on book detail

- **Description:** Book detail "Lending history" disclosure listing past loans (borrower, dates, note), newest first.
- **Files:** `src/components/loans/BookLoanHistory.tsx`, `src/db/repositories/loans.ts` (`listLoansForBook`, which exists).
- **Acceptance:** hidden when no history; correct order.
- **Tests:** `src/components/loans/__tests__/BookLoanHistory.test.tsx`.

### P05-08 Due-date reminders (local notifications)

- **Description:** Optional, off by default. Settings toggle "Remind me when loans are due" → request notification permission (`expo-notifications`, installed with `npx expo install expo-notifications`) → schedule a **local** notification at 10:00 on the due date for each open loan with a due date; reschedule on lend/return/edit and on app start. No push service, no server. Tapping the notification opens the loan's book.
- **Files:** `src/services/reminders/reminders.native.ts`, `src/services/reminders/reminders.web.ts` (no-op), `src/features/loans/useReminderSync.ts`, `app.json` (plugin).
- **Acceptance:** scheduled set equals open loans with due dates (diffed by id); disabled toggle cancels all.
- **Tests:** `src/services/reminders/__tests__/reminders.test.ts` (mocked module), `src/features/loans/__tests__/useReminderSync.test.tsx`.

### P05-09 Loan badges on the Shelf

- **Description:** `BookRow` shows a small "On loan" stamp (and "Overdue" in danger tone); Shelf filter "On loan only" (full filter panel in P06-10).
- **Files:** `src/components/book/BookRow.tsx`, `src/db/repositories/books.ts` (list includes loan status).
- **Acceptance:** status matches Loans tab; accessible label includes "on loan to Sam".
- **Tests:** `src/components/book/__tests__/BookRow.test.tsx` (loan variants).

### P05-10 Overdue Booky nudge

- **Description:** On app foreground, if any loan is overdue and the nudge for that loan has not been shown today, Booky (*concerned*) shows "'Dune' was due back from Sam 3 days ago." with action "Open loans". Rule registered with the engine in P07-02 (tip id `loan-overdue:<loanId>:<date>`).
- **Files:** `src/features/loans/overdueNudge.ts`.
- **Acceptance:** at most once per loan per day; respects Booky mode.
- **Tests:** `src/features/loans/__tests__/overdueNudge.test.ts`.

---

## Test ids to add to `selectors.json`

```json
{
  "lend": {
    "open": "lend-open", "sheet": "lend-sheet", "borrowerSearch": "lend-borrower-search",
    "borrowerOption": "lend-borrower-option", "borrowerCreate": "lend-borrower-create",
    "borrowerContact": "lend-borrower-contact", "lentOn": "lend-lent-on", "dueOn": "lend-due-on",
    "noDueDate": "lend-no-due-date", "note": "lend-note", "save": "lend-save"
  },
  "returnLoan": { "open": "return-open", "sheet": "return-sheet", "date": "return-date", "confirm": "return-confirm" },
  "loans": {
    "root": "loans-root", "title": "loans-title", "tabOut": "loans-tab-out", "tabHistory": "loans-tab-history",
    "row": "loans-row", "stamp": "loans-stamp", "rowReturn": "loans-row-return", "filterBorrower": "loans-filter-borrower"
  },
  "borrower": { "root": "borrower-root", "name": "borrower-name", "current": "borrower-current", "past": "borrower-past", "edit": "borrower-edit", "delete": "borrower-delete" },
  "bookLoan": { "stamp": "book-loan-stamp", "history": "book-loan-history" },
  "reminders": { "toggle": "reminders-toggle" }
}
```

(`loans.root` and `loans.title` exist from P00-11 — extend the group.)

## Auto test suite journeys

Each journey is added by the card that builds its screen. Suite `core` journeys run in `smoke` (CI and the regression gate); the rest use suite `p05` (`npm run -s autotest -- journey --suite p05`).

| Journey | Suite | Steps |
|---|---|---|
| `loans-overview` | `core` | fixture `demo` with `today` fixed; Loans tab → 2 rows, overdue first with "OVERDUE" stamp |
| `loan-lend-return` | `core` | fixture `demo`; open a home book → lend to new borrower "Sam" due in 14 days → stamp on detail → Loans tab shows it → mark returned → History contains it |
| `loan-double-lend-blocked` | `p05` | open a book already on loan → no Lend button, "Mark returned" visible |
| `borrower-detail` | `p05` | open loan row borrower → current and past lists |
| `loans-empty` | `p05` | fixture `empty` → Booky sleepy empty state |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/loan-lend-return.yaml` | device: lend with the native date picker, return, verify stamps |
| `.maestro/loan-reminder.yaml` | enable reminders → grant notification permission → verify toggle state persists (notification delivery checked manually; tagged `manual` for the delivery step) |

## Risks

| Risk | Mitigation |
|---|---|
| Timezone bugs in due dates | calendar dates as local `YYYY-MM-DD`; injectable clock; boundary tests |
| Notification permission fatigue | off by default; ask only when the user enables it |
| Personal data about borrowers | stays local; never sent anywhere; excluded from CSV export unless the user ticks "include loans" (P08-04) |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + lint + typecheck + Jest
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- Lend, return, history, borrower views and overdue detection work on Android and web.
- All P05 journeys pass with `--ux-gates fail`; Maestro flows pass (manual delivery step noted).
- Regression gate green in CI.
