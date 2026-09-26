# Phase 10 — Ratings

## Goal

Let the reader say what they thought of each book: whole stars from 1 to 5, set in a tap from the book's page or the form, shown on the Shelf, used to sort, filter and group it, and carried by every way a library leaves or enters the app (backups, CSV, a Goodreads export). A rating is the reader's own opinion: nothing the app looks up ever changes it.

## Scope

- One nullable column, `books.rating` (1–5, `NULL` for not rated), added by a migration.
- A star rating control and a read-only star display.
- Rating from book detail (saved at once) and in the add/edit form.
- Ratings on Shelf rows and covers and in every book's accessible name.
- Sort by rating, filter by a minimum rating, group by rating; all kept in the Shelf's saved preferences.
- CSV export and import (the MyShelf preset, other spreadsheets and Goodreads' "My Rating"), and backups (older backups still restore).

## Out of scope

- Half stars, reviews, or ratings from Open Library or Google Books (the average rating a provider knows is not the reader's).
- Multi-key sorting: the separate sort-builder work turns rating into one of its keys.

## Prerequisites

- Phases 01, 06 and 08 (Shelf, filters and preferences, backups and CSV), and P09-03 (the search index the migration must leave alone).

---

## Task cards

### P10-01 Rating column, model and repository — done

- **Description:** Migration with the next free number adding `rating INTEGER NULL CHECK (rating BETWEEN 1 AND 5)` to `books`. `Book.rating` and `BookListItem.rating`; `booksRepo.setRating(bookId, rating | null)`; list items carry the rating. The search index (0006, `book_search_source` and its triggers) must be unaffected. "Refresh details" and lookups never write the rating.
- **Files:** `src/db/migrations/0007_book_rating.ts`, `src/db/migrations/index.ts`, `src/domain/book.ts`, `src/domain/rating.ts`, `src/domain/bookDraft.ts`, `src/db/repositories/{shared,books,bookLookups}.ts`.
- **Acceptance:** a fresh database and an existing v6 database both reach v7 with every book not rated; the CHECK refuses 0, 6 and fractions; a refresh leaves the rating as it was.
- **Tests:** `src/db/repositories/__tests__/books.rating.test.ts`, `src/domain/__tests__/rating.test.ts`.
- **Delivered:** migration `0007_book_rating` (the next free number on `main`): `ALTER TABLE books ADD COLUMN rating INTEGER NULL CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5 AND typeof(rating) = 'integer'))` plus `books_rating_idx`. The `typeof` term is the one addition to the decided column: INTEGER affinity stores 4.0 as 4, but 4.5 stays a REAL and would pass a plain `BETWEEN`. The search index needs no change: its view names its columns rather than `b.*`, and its `books` update trigger fires only for `title`, `subtitle`, `notes`, the ISBNs and `series_id`, so a rating write never touches it (tested on both the plain and the FTS5 index). `setRating` writes the rating and `updated_at` only, and throws `RangeError` for anything but 1–5 or null. `ValidBookDraft.rating` is optional: the form sets it, and `refreshBook` saves its draft with `rating: undefined`, so "Refresh details" cannot change it whatever the draft holds. `src/domain/rating.ts` holds the words ("4 out of 5 stars", "rated 4 out of 5", "Rated 4 stars", "4 stars and up") and the key and tap rules. The two pre-0006 search tests now migrate every migration but 0006, since the repository reads today's columns.

### P10-02 Star rating control — done

- **Description:** `StarRating` in `src/components/ui`, in the purple library theme, light and dark: one accessible control ("Rating: 4 out of 5 stars"), increment/decrement actions for TalkBack, arrow keys and Home/End on the web, 48 dp targets, a tap on the current rating clears it, an explicit "Clear rating". A small read-only variant for rows. Respect reduced motion if animated.
- **Files:** `src/components/ui/StarRating.tsx`, `src/components/ui/index.ts`, `src/testing/selectors.json`.
- **Acceptance:** one tab stop; value, name and actions exposed; clear works by tap and by button.
- **Tests:** `src/components/ui/__tests__/StarRating.test.tsx`.
- **Delivered:** a single adjustable control: `role="slider"` (TalkBack's "adjustable"), named "Rating", `aria-valuemin` 0 ("Not rated") to `aria-valuemax` 5, `aria-valuetext` "4 out of 5 stars", and `accessibilityActions` increment and decrement (TalkBack's swipe up and down), which step down to not rated. On the web the arrow keys add or take a star, Home clears, End gives 5, a digit sets it and Delete, Backspace or 0 clear (`ratingForKey`). The five stars are 48 dp pressables for fingers and pointers, hidden from screen readers and out of the tab order (`tabIndex -1`, inside `aria-hidden`), so the slider is the one stop; a click hands focus back to the slider. "Clear rating" is an icon button beside the stars, disabled when there is nothing to clear, and gives focus back to the slider. Filled stars are `primary`, empty ones `outline` (star and outline shapes differ too, so nothing rests on colour); the focused slider gets a `primary` border. `StarRatingDisplay` draws small stars for rows and covers, hidden from screen readers because the row's name says the rating. No animation, so reduced motion has nothing to turn off.

### P10-03 Rate from book detail — done

- **Description:** "Your rating" on a book's page: rate inline, saved immediately, "Rated 4 stars" announced politely.
- **Files:** `src/features/book/BookRating.tsx`, `src/features/book/BookDetailScreen.tsx`.
- **Acceptance:** a rating survives leaving the page and a reload; the announcement is a polite live region.
- **Tests:** `src/__tests__/bookDetail.test.tsx`; journeys `rating-detail-persists`, `rating-keyboard`.
- **Delivered:** a "Your rating" section (level-2 heading) under the catalogue card. Each change is saved at once with `setRating` and emits `library-changed`, so the Shelf follows; a caption below the stars is a polite live region (`role="status"`, `accessibilityLiveRegion`) that says "Rated 4 stars" or "Rating cleared" after a change and "Tap a star to rate this book." before the first. The stars move straight away; a failed save puts them back and a snackbar says so. The reader's latest choice is kept while earlier saves' reloads arrive (quick key presses once lost a step to a stale reload); once nothing is saving, a rating changed elsewhere (the edit form) wins.

### P10-04 Rate in the add/edit form — done

- **Description:** The same control in the book form; saving writes it.
- **Files:** `src/components/book/BookForm.tsx`.
- **Acceptance:** a new book saves with its rating; editing shows the stored rating, and changing or clearing it counts as an unsaved change.
- **Tests:** `src/__tests__/bookForm.test.tsx`; journey `rating-form`.
- **Delivered:** a "Your rating" section between Series and Summary and notes, with "Just for you. Looking up the book’s details never changes it." `BookDraft.rating` rides along with the other fields, so the unsaved-changes guard sees it.

### P10-05 Ratings on the Shelf — done

- **Description:** Read-only compact stars on rows and the covers grid, and the rating in every book's accessible name (`bookRowLabel`: "…, rated 4 out of 5"); journeys that assert exact names updated.
- **Files:** `src/components/book/{BookRow,CoverGrid}.tsx`.
- **Acceptance:** rated books show stars and say their rating; unrated books show and say nothing.
- **Tests:** `src/components/book/__tests__/{BookRow,CoverGrid}.test.tsx`, `src/__tests__/shelf.test.tsx`.
- **Delivered:** `bookRowLabel` puts the rating after the year and before a loan ("Dune, by Frank Herbert, 1965, rated 4 out of 5, on loan to Sam"), for rows, cover cells and spines alike. Rows show 14 dp stars after the year; covers show 12 dp stars under the title. Spines get the rating in their name only: a 44 dp spine has no room for five stars. The demo fixture now rates seven books (5, 5, 5, 4, 4, 3, 3), so the journeys `shelf-demo-list`, `book-delete-undo`, `shelf-loan-badge`, `shelf-view-modes` and the `csv-export` header check were updated.

### P10-06 Sort, filter and group by rating — done

- **Description:** Sort by rating (unrated last), filter by a minimum rating, integrated with the sort menu, the filter sheet and the saved Shelf preferences; group by rating if it fits the existing group-by.
- **Files:** `src/domain/{book,shelfFilters,shelfView,settings}.ts`, `src/db/repositories/{books,shelfSections}.ts`, `src/components/book/{ShelfToolbar,FilterSheet}.tsx`, `src/features/settings/preferenceOptions.ts`.
- **Acceptance:** unrated books last in both directions; the filter chip removes itself; sort, filter and grouping survive a reload.
- **Tests:** `books.rating.test.ts`, `src/domain/__tests__/{shelfFilters,shelfView}.test.ts`, `src/__tests__/shelf.groupBy.test.tsx`; journey `rating-sort-filter`.
- **Delivered:** `rating` is one more `ShelfSortKey` (the sort model and its stored format are unchanged, so the coming sort builder can take it as a key): highest first by default, "Highest first"/"Lowest first", unrated last either way, ties in title order; Settings → Shelf and lending offers both orders. `ShelfFilters.minRating` (1–5 or null; older stored filters read as null) becomes `b.rating >= ?`, a "Your rating" radio group in the filter sheet (Any, 5 stars, 4 stars and up … 1 star and up), shown once any book is rated (`FilterOptions.hasRatings`) or while the filter is on, and a removable chip. Group by Rating fits the existing group-by: sections "5 stars" … "1 star", best first, then "Not rated", with no page to open.

### P10-07 Ratings in CSV export and import — done

- **Description:** Goodreads "My Rating" maps to the rating (0 means unrated, 1–5 straight through); the generic mapping and the CSV export include a Rating column; the Goodreads fixture carries ratings.
- **Files:** `src/services/backup/{exportCsv,csvPresets,importCsv,index}.ts`, `src/db/repositories/bookExport.ts`, `src/services/backup/__fixtures__/goodreads_library_export.csv`.
- **Acceptance:** a Goodreads import brings every rating; MyShelf's own CSV round-trips them.
- **Tests:** `src/services/backup/__tests__/{importCsv,exportCsv,csvPresets}.test.ts`; journey `rating-goodreads-import`.
- **Delivered:** the export writes a `Rating` column after Groups (blank when not rated), and the MyShelf preset reads it back (an export from before ratings is still recognised). The mapper offers "Your rating (1 to 5 stars)" and guesses it from "Rating", "My rating", "Stars" or "Score". `parseImportRating`: 1–5 (4.0 is 4); blank or 0 is not rated; anything else is left out with a warning in the preview. The Goodreads fixture already had "My Rating" 0, 3, 4 and 5; two books now have 2 and 1 so every value is covered (16 rated, 4 not).

### P10-08 Ratings in backups — done

- **Description:** Backup JSON includes `rating`; a backup from before this migration still restores (schema version bumped per the existing policy, migrated forward); round-trip tests.
- **Files:** `src/domain/backup.ts`, `src/services/backup/validateBackup.ts`.
- **Acceptance:** replace and merge keep ratings; a schema 6 file restores with every book not rated; a rating outside 1–5 is refused as damaged.
- **Tests:** `src/services/backup/__tests__/{importBackup,validateBackup}.test.ts`; journey `rating-backup-roundtrip`.
- **Delivered:** the policy is that a backup's `schemaVersion` is the database's version, so files are now written at 7; `formatVersion` stays 1 (the document's shape is unchanged). A column added to an existing table now carries `since` in `backupTables` (`rating` since 7), and `backupColumnsAt` gives a table's columns at a file's version: a schema 6 file is checked without `rating` (and one that has it is refused), then brought forward by the real migrations in a scratch database as before. A rating that is not 1–5 or null is "damaged".

### P10-09 Booky: how to rate — done

- **Description:** Optionally, one gentle tip ("Tap the stars to rate a book") on the first visit to a book, only if it fits the tips engine's rules and never covers controls.
- **Files:** `src/components/booky/{tips,helpContent}.ts`.
- **Delivered:** in Booky's help rather than an unprompted tip: the book page's help bubble now starts "Everything about this book. Rate it, lend it, …" and its help sheet has a "Your rating" section. **Not built:** the unprompted first-visit tip. It would need a new trigger on the book page, which has no tab bar, so the overlay bubble would sit over the page's lower controls (the loan buttons) on a phone; help on request says the same without covering anything.

---

## Test ids added to `selectors.json`

```json
{
  "home": { "sortRating": "home-sort-rating" },
  "shelfView": { "groupByRating": "shelf-group-by-rating", "filterRatingAny": "shelf-filter-rating-any", "filterRating": "shelf-filter-rating" },
  "bookDetail": { "rating": "book-detail-rating" },
  "bookForm": { "rating": "book-form-rating" },
  "rating": { "control": "rating-control", "star": "rating-star", "clear": "rating-clear", "status": "rating-status", "display": "rating-display" }
}
```

## Auto test suite journeys

Suite `p10` (`npm run -s autotest -- journey --suite p10`), gates set to fail.

| Journey | Suite | Steps |
|---|---|---|
| `rating-detail-persists` | `p10` | rate an unrated demo book from its page → "Rated 4 stars" (polite live region) → the Shelf row reads it back → a page load still shows it → a second tap clears it |
| `rating-form` | `p10` | add a book with 5 stars; edit a demo book from 4 to 2 stars with the keyboard; page and row say 2 |
| `rating-sort-filter` | `p10` | sort by Rating both ways (unrated last); "4 stars and up" leaves 5 books with a chip; group by Rating; read back on Settings → Shelf and lending; kept after a reload |
| `rating-goodreads-import` | `p10` | the Goodreads export's "My Rating" becomes each book's rating (16 rated, 0 → not rated), in names, on covers and on a book's page |
| `rating-backup-roundtrip` | `p10` | backup carries `rating` → changes → restore puts every rating back → the same file as schema 6 restores with none |
| `rating-keyboard` | `p10` | Tab reaches the slider (stars are not tab stops); arrows, Home, End and a digit, each saved and announced; Tab to Clear rating, Enter clears and focus returns |
| `rating-dark` | `p10` | dark scheme: stars on rows, covers, the sort menu, the filter sheet, a book's page and the form paint dark `primary`/`outline`; gates and screenshots |

## Risks

| Risk | Mitigation |
|---|---|
| A lookup or refresh overwrites the reader's opinion | the refresh path saves without a rating (`rating: undefined`), tested |
| Older backups missing the column | columns carry `since`; files are checked at their own version and migrated forward |
| A row's name grows longer | the rating is a short phrase after the year; large-text journeys unchanged |

## Regression gate

As every phase: `npm run check`, `npm run autotest:check`, `npm run autotest:selftest`, and every journey (bar `live` and `perf`) with `--ux-gates fail` against the web export.

## Exit criteria

- Every card above ticked in `STATUS.md`; `p10` journeys green with gates enforced.
