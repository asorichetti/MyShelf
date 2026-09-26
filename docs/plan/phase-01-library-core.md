# Phase 01 — Library core: CRUD and book detail

## Goal

A usable, offline catalogue: the user can add a book by hand, see it on the Shelf as a catalogue card, open its detail page, edit every field (including authors and genres), and delete it. Test fixtures make every screen reachable in a known state for the auto test suite and Maestro.

## Scope

- E2E fixture loader for deterministic tests.
- Shelf list with search and sort.
- Add / edit book form with validation; authors and genres editors.
- Book detail screen (catalogue-card header, metadata, summary, notes).
- Delete with confirmation and undo.
- Cover display with generated fallback cover.

## Out of scope

- Online lookup (Phase 02), scanning (Phase 03).
- Series editing beyond showing the stored series name (Phase 04).
- Lending actions (Phase 05); group-by and user groups (Phase 06).

## Prerequisites

- Phase 00 complete: theme, UI primitives (including `CatalogueCard`, `Chip`, `Stamp`, `ConfirmDialog` and `Snackbar` from P00-30), Booky, tabs, `Db` + repositories + `0001_init`, the auto test suite, CI.
- Screens follow the Phase 00 layout: a route file in `src/app` re-exports a screen from `src/features/<feature>/`, and repository functions are called as `booksRepo.createBook(db, …)` with the `Db` from `useDatabase()`.

---

## Task cards

### P01-01 E2E fixture loader — done

- **Description:** A route `src/app/e2e/index.tsx` that, only when `process.env.EXPO_PUBLIC_E2E === '1'`, wipes the database, loads a named fixture and redirects: `/e2e?fixture=<name>&next=<route>` (web) and `myshelf://e2e?fixture=<name>&next=<route>` (Android). In other builds it renders a "not found" screen and touches nothing. Fixtures are TypeScript data in `src/testing/fixtures/` (`empty`, `demo` — 12 books across 4 genres, 2 series with a gap, 3 authors with multiple books, 1 open loan, 1 overdue loan, 1 group — and `large` — 2,000 generated books for performance checks). A `loadFixture(db, name)` helper is shared with Jest. Freeze "today" for fixtures via an optional `&today=YYYY-MM-DD` param stored in memory for the session.
- **Files:** `src/app/e2e/index.tsx`, `src/testing/fixtures/{index,empty,demo,large}.ts`, `src/testing/loadFixture.ts`, `src/domain/dates.ts` (clock override).
- **Acceptance:** with `EXPO_PUBLIC_E2E=1`, `/e2e?fixture=demo&next=/` shows 12 books; without the flag, the route loads nothing and shows not-found; fixture loading is one transaction.
- **Tests:** `src/testing/__tests__/loadFixture.test.ts` (node env: counts per table for each fixture), `src/app/e2e/__tests__/e2e.test.tsx` (flag on/off behaviour).
- **Delivered:** the route re-exports `E2eScreen` from `src/features/e2e/` (with `e2eFlag.ts`), so the flag test is `src/features/e2e/__tests__/e2e.test.tsx` (nothing but routes lives in `src/app`). The flag is per platform ([ADR 0015](../adr/0015-e2e-fixture-loader-per-platform.md)): on Android it needs `EXPO_PUBLIC_E2E=1`, which the committed `.env.development` sets for `expo start` only (`expo export` and release builds do not load it); on web, a test-only target that CI serves as a static export, it is on unless `EXPO_PUBLIC_E2E=0` (`e2eFlag.web.ts`). The wipe is `libraryRepo.wipeLibrary(db)` (`src/db/repositories/library.ts`, with `countRows` for tests), since SQL stays in `src/db`; settings survive a wipe. Fixture types are in `src/testing/fixtures/types.ts`; loan dates are relative to `today()` (so the overdue loan stays overdue), and `setToday()` in `src/domain/dates.ts` freezes them. `demo` also has a returned loan (Mort) for loan history; `next` must be an in-app path. An unknown fixture shows `page-error` and loads nothing.

### P01-02 Books repository: list, search and sort queries — done

- **Description:** Extend `booksRepo` (`src/db/repositories/books.ts`, which already has `listBooks`, `searchBooks` and `countBooks`): `listBookItems(db, { query?, sort, direction, limit, offset })` returning `BookListItem` (id, title, subtitle, primary author, cover_uri, publication_year, series name + position, on-loan flag). Search matches title, subtitle, author names (as `searchBooks` does today) and ISBN (normalised) case-insensitively. Sorts: `title` (ignoring leading "The/A/An"), `author` (sort_name), `year`, `added` (created_at). `getBookDetail(db, id)` returns `BookDetail` with authors (ordered), genres, series, open loan.
- **Files:** `src/db/repositories/books.ts`, `src/domain/book.ts` (`sortableTitle`).
- **Acceptance:** each sort order correct on the `demo` fixture; search "prat" finds Pratchett; ISBN search with hyphens works; list query uses indexes (no N+1 — one query plus one for authors).
- **Tests:** `src/db/repositories/__tests__/books.list.test.ts`, `src/domain/__tests__/book.test.ts`.
- **Delivered:** `BookListItem` carries every credited author (`authors: string[]`, the first is the primary one) rather than one name, and search also matches the series name ("earthsea"). Sorting runs in SQL (a `CASE` twin of `sortableTitle`); books without an author or year sort last in both directions. `BookListItem`, `BookDetail`, `ShelfSort` and the display helpers `seriesLabel`, `formatSeriesPosition` and `joinNames` live in `src/domain/book.ts`. ISBN matching only kicks in for digit-like queries of four or more digits.

### P01-03 Shelf screen (list of catalogue cards) — done

- **Description:** `useShelf()` feature hook (loads list, reloads on focus and on a `library-changed` event). The Shelf screen (`src/features/shelf/ShelfScreen.tsx`, re-exported by `src/app/(tabs)/index.tsx`) renders a `FlatList` of `BookRow` (compact catalogue card: cover thumb, title in Lora, author and year in Courier Prime, series badge "Discworld #5", "On loan" stamp). Tapping opens `/book/[id]`. Floating "Add book" button. Empty state: the existing one (Booky *happy*, "Your shelf is empty", Scan action) gains an "Add manually" action.
- **Files:** `src/features/shelf/useShelf.ts`, `src/features/events.ts`, `src/components/book/BookRow.tsx`, `src/features/shelf/ShelfScreen.tsx`.
- **Acceptance:** 12 rows with `demo`; empty state with `empty`; row accessible label "Title, by Author, Year"; list scrolls smoothly with `large`.
- **Tests:** `src/features/shelf/__tests__/useShelf.test.tsx`, `src/components/book/__tests__/BookRow.test.tsx`, `src/__tests__/shelf.test.tsx`.
- **Delivered:** `useShelf` reloads on mount and on `library-changed`; there is no separate focus listener because tab screens are unmounted when they lose focus (and also when a stack screen such as the book detail covers them), so every return to the Shelf is a mount. The row label adds ", on loan" when the book is out; rows carry every author ("Terry Pratchett and Neil Gaiman"). The list is a `FlatList` inside a non-scrolling `Screen`, with memoised rows and bounded render batches; rows have variable height (titles wrap to two lines), so there is no `getItemLayout`. The "Add book" floating button and the empty state's "Add manually" share `home.addButton` (only one is ever shown) and the button steps up while a snackbar is showing. `useBookCount` is gone (the count comes from `useShelf`). A root `SnackbarProvider` and `AppSnackbarHost` (`src/features/navigation/`) are added here; `renderApp` (`src/testing/renderApp.tsx`) renders the tab routes for app-level tests.

### P01-04 Shelf search and sort controls — done

- **Description:** Search field (debounced 200 ms, clear button) and a sort menu (Title, Author, Year, Recently added; direction toggle) above the list. Current sort persisted in `settings` (key `shelfSort`). "No matches" state with Booky (*thinking*) and a "Clear search" action.
- **Files:** `src/components/book/ShelfToolbar.tsx`, `src/features/shelf/ShelfScreen.tsx`, `src/domain/settings.ts` (`shelfSort` in `AppSettings` and `settingDefaults`).
- **Acceptance:** typing filters results; sort survives app restart; screen reader announces result count.
- **Tests:** `src/components/book/__tests__/ShelfToolbar.test.tsx`, `src/__tests__/shelf.search.test.tsx`.
- **Delivered:** the sort menu is a disclosure (`aria-expanded`) that opens an inline panel of radio chips plus a direction button (`home.sortDirection`: "A to Z" / "Z to A", "Oldest first" / "Newest first"); picking "Recently added" starts newest first. The result count is a polite live region under the toolbar (`home.resultCount`: "Showing all 12 books", "4 of 12 books match “prat”"). The debounce is `useDebouncedValue` in `src/hooks`.

### P01-05 Book form model and validation — done

- **Description:** Pure `BookDraft` validation in `src/domain/bookDraft.ts`: title required (≤ 300 chars); ISBN optional but must pass checksum (accepts hyphens/spaces, ISBN-10 converted to ISBN-13 and both stored); year 1450–(current year + 1); page count positive integer; language from a list; format enum; series position ≥ 0 with up to one decimal. Returns field-level error messages in plain language ("That ISBN doesn't look right — check the last digit").
- **Files:** `src/domain/bookDraft.ts`, `src/domain/languages.ts`.
- **Acceptance:** every rule has a passing and failing case; messages are friendly.
- **Tests:** `src/domain/__tests__/bookDraft.test.ts`.
- **Delivered:** `validateBookDraft(draft, { currentYear })` returns `{ ok, value }` (cleaned `ValidBookDraft`: empty text becomes null, authors and genres trimmed and de-duplicated case-insensitively) or `{ ok: false, errors }`; also `emptyDraft`, `draftFromDetail`, `draftFieldOrder`, `firstInvalidField` and `draftsDiffer`. A series position needs a series name. A 979 ISBN-13 has no ISBN-10, so only the 13 is stored. The series position is read with `parseSeriesPosition` (P04-02: "3", "Book 3", "III", "2.5") and must be positive, so 0 is refused. `languages.ts` keeps Phase 02's `toIso6391` and adds the form's list of every language it can produce (`languages`, `languageName`); `isLanguageCode` accepts any two-letter code, since a lookup may bring one outside the list. 

### P01-06 Book detail screen — done

- **Description:** Route `src/app/book/[id].tsx`. Header is a large `CatalogueCard`: cover, title/subtitle (Lora), authors, a "call number" line in Courier Prime (e.g. `FIC PRA 1987`), publisher, year, edition, format, pages, language, ISBN-13/10. Sections: Summary (collapsed to 5 lines with "Read more"), Genres (chips), Series ("Discworld · #5", link placeholder until Phase 04), Notes, Loan status (placeholder until Phase 05). Header actions: Edit, Delete (overflow). Missing book id → `page-error` with Booky (*concerned*) and "Back to shelf".
- **Files:** `src/app/book/[id].tsx`, `src/features/book/useBook.ts`, `src/components/book/{BookHeader,CallNumber,SummaryText,GenreChips}.tsx`, `src/domain/callNumber.ts`.
- **Acceptance:** all fields render from `demo`; empty fields hidden (no "undefined"); unknown id shows error state; headings have `role="heading"`.
- **Tests:** `src/__tests__/bookDetail.test.tsx`, `src/domain/__tests__/callNumber.test.ts`, component tests.
- **Delivered:** the screen is `src/features/book/BookDetailScreen.tsx` (the route re-exports it). The book title is the page's `h1`; sections are `h2`. The header bar has Back and Edit; the overflow menu (a new `Menu` primitive in `src/components/ui`) arrives with Delete in P01-11. The call number's class comes from the first genre (fiction genres are `FIC`, non-fiction subjects have their own codes, `GEN` with none) and the mark from the first author's sort name, or the title when there is no author. The loan section already shows the open loan with a due, due-soon or overdue stamp from `loanStatus` (P05-02) and `formatDate` (`src/domain/dates.ts`), not a placeholder; the series line uses `formatSeriesPosition` (P04-02). A missing or malformed id shows `page-error` with its own `bookMissing` test ids. Component tests are in `src/components/book/__tests__/detailParts.test.tsx`.

### P01-07 Add and edit book form — done

- **Description:** Routes `src/app/book/new.tsx` and `src/app/book/[id]/edit.tsx` sharing `BookForm`. Fields: title, subtitle, authors (P01-08), ISBN, publisher, year, edition, format, pages, language, genres (P01-09), series name + position (free text / number for now), summary (multiline), notes. Inline errors from P01-05, focus moves to the first invalid field on submit. Save writes book + authors + genres in one repository transaction (a new `booksRepo.saveBookDraft(db, draft, id?)` built on `createBook`/`updateBook`, `authorsRepo.setBookAuthors` and `genresRepo.setBookGenres`), sets `source='manual'` for new books, emits `library-changed`, navigates to detail and shows a snackbar "Saved". Leaving with unsaved changes asks for confirmation.
- **Files:** `src/app/book/new.tsx`, `src/app/book/[id]/edit.tsx`, `src/components/book/BookForm.tsx`, `src/features/book/useBookForm.ts`, `src/db/repositories/books.ts`.
- **Acceptance:** create then edit round-trips every field; invalid ISBN blocks save with message; unsaved-changes guard works on Android back and on web.
- **Tests:** `src/features/book/__tests__/useBookForm.test.tsx`, `src/components/book/__tests__/BookForm.test.tsx`, `src/db/repositories/__tests__/books.write.test.ts`.
- **Delivered:** the routes re-export `AddBookScreen` and `EditBookScreen` from `src/features/book/BookFormScreen.tsx`; the edit route is `src/app/book/[id]/edit.tsx` next to `src/app/book/[id].tsx`. The form is grouped into h2 sections (The book, Edition, Genres, Series, Summary and notes) with a Save bar that stays below the scrolling fields; format is a radio group of chips and language a `SelectField` (a new primitive: a 48 dp trigger opening a modal radio list). A failed save shows an alert summary (`bookForm.error`, "Please check the ISBN field.") and moves focus to the first invalid field. Save includes a name or genre typed but not yet added. After saving a new book the form is replaced by its detail page with the snackbar "Saved “Title” to your shelf"; after an edit it goes back to the detail page ("Saved your changes"). The unsaved-changes guard (`useUnsavedChangesGuard`) holds up `beforeRemove` (Android back, the Cancel and back buttons, browser back) behind a `ConfirmDialog` with Booky, and `useBeforeUnload` (web) asks before the tab closes. Flow tests are in `src/__tests__/bookForm.test.tsx`.

### P01-08 Authors editor — done

- **Description:** Chip input: type a name, pick an existing author from suggestions (new `authorsRepo.searchAuthors(db, prefix)`) or create a new one (`findOrCreateAuthor`, already case-insensitive); reorder with move-up/move-down buttons; role selector (author, illustrator, translator, editor). `sort_name` derived with `toSortName()` (`src/domain/author.ts`) and editable in an "advanced" disclosure (for names like "Ursula K. Le Guin" → "Le Guin, Ursula K."). Orphaned authors are deleted when their last book is removed.
- **Files:** `src/components/book/AuthorsInput.tsx`, `src/db/repositories/authors.ts`, `src/domain/author.ts`.
- **Acceptance:** duplicate author names reuse the same row (case-insensitive); order persists; orphan cleanup verified.
- **Tests:** `src/components/book/__tests__/AuthorsInput.test.tsx`, `src/db/repositories/__tests__/authors.test.ts`, `src/domain/__tests__/authors.test.ts` (particles such as van, de and Le are covered already; add any new cases).
- **Delivered:** each credited author is a row (`bookForm.authorChip`) with move up/down (shown when there are two or more), a "Details" disclosure holding the role radio chips and the "Filed as" sort name, and remove. `searchAuthors` matches the start of the name or of any word ("prat" finds Terry Pratchett). The typed-but-not-added name is owned by the form, so Save includes it. `deleteOrphanAuthors(db)` runs inside `saveBookDraft` (P01-07) and the delete (P01-11). A typed sort name is stored on the shared author row. `addDraftAuthor` lives in `src/domain/bookDraft.ts`. `TextField` now takes a `ref` and supports `multiline`.

### P01-09 Genres editor — done

- **Description:** Chip multi-select with suggestions from existing genres plus a curated starter list (`starterGenres` in `src/domain/genre.ts`: Fiction, Fantasy, Science Fiction, Mystery, Thriller, Romance, Historical Fiction, Horror, Literary Fiction, Young Adult, Children's, Graphic Novel, Poetry, Biography, Memoir, History, Science, Philosophy, Self-Help, Cookery, Travel, Art, Religion, Business, Reference). Any genre the user adds or keeps in the form is saved with `user_edited = 1`.
- **Files:** `src/components/book/GenresInput.tsx`, `src/domain/genre.ts`, `src/db/repositories/genres.ts`.
- **Acceptance:** case-insensitive de-duplication; removing a genre from the last book leaves the genre row (genres are managed in P06-02).
- **Tests:** `src/components/book/__tests__/GenresInput.test.tsx`, `src/db/repositories/__tests__/genres.test.ts`.
- **Delivered:** chosen genres are removable chips (`bookForm.genreChip`); suggestion chips (`bookForm.genreSuggestion`) come from `genreSuggestions(existing, chosen, query)` in `src/domain/genre.ts`: the library's genres first, then the starter list, matched at the start of any word. `starterGenres` is `curatedGenres` from `src/domain/genres.ts` (Phase 02's genre normaliser maps onto the same names). A typed genre that already exists keeps the library's spelling (`addDraftGenre`). `saveBookDraft` stores every genre in the form with `user_edited = 1`.

### P01-10 Cover image and generated fallback — done

- **Description:** `CoverImage` using `expo-image` (install with `npx expo install expo-image`) with placeholder and error fallback to `GeneratedCover`: an SVG cover in theme purples/brass, colour chosen by a stable hash of the title, title and author set in Lora. Sizes `thumb` (48×72), `medium` (120×180), `large` (200×300). Decorative when adjacent text already names the book.
- **Files:** `src/components/book/CoverImage.tsx`, `src/components/book/GeneratedCover.tsx`, `src/domain/hashColour.ts`.
- **Acceptance:** same title always gets the same colour; broken URI falls back without console errors.
- **Tests:** `src/components/book/__tests__/CoverImage.test.tsx`, `src/domain/__tests__/hashColour.test.ts`.
- **Delivered:** built before P01-03, which uses it. **Real cover art is the golden path**; the generated cover is only the fallback.
  - `CoverImage` shows `cover_uri` (a `file://` copy on the device, a remote https URL on web) in a 2:3 frame on card stock, with a soft placeholder (tint and a book icon, `cover.placeholder`) while it loads and a 200 ms fade-in (none with reduce motion). It uses **`contentFit="contain"`** on the near-white `surface`: a cover is never cropped (its title and author stay whole), a cover of another shape gets thin card-coloured margins like a mount, and an Open Library scan padded with white bars (the Philosopher's Stone cover is a 300 × 300 square) blends its bars into the card instead of looking broken. Detecting and trimming the padding would need pixel access on every platform for a small gain, so it was not done. Device files are never cached (`cachePolicy="none"`), so a new photo of a cover shows at once. On error, or with no `cover_uri`, `GeneratedCover` (`cover.fallback`) takes its place.
  - `GeneratedCover` is a cloth-coloured `View` with an SVG layer for the spine hinge and brass rules, and the title and author as wrapping `Text` in Lora (SVG text cannot wrap); a thumbnail shows the title's initial. Bindings come from `coverPalette` and sizes from `coverSizes` in `src/theme/tokens.ts`; every binding's ink is checked for AA. `hashColour(title, count)` is FNV-1a over the trimmed, lower-cased title.
  - The `demo` fixture gives ten books real `covers.openlibrary.org` URLs (ids from the recorded Open Library fixtures where there is one, the ISBN endpoint with `default=false` otherwise), The Farthest Shore none, and The Murder of Roger Ackroyd a broken URL carrying the suite's `__expected-404` marker. The auto test suite routes every `covers.openlibrary.org` request to two synthetic JPEGs it generated (plain shapes; a 2:3 cover and a white-padded 300 × 300 scan for Pride and Prejudice's id; `tools/auto-test-suite/src/browser/covers.ts`), so journeys use the real-image path offline. `shelf-demo-list` and `book-covers` assert that real covers render (`naturalWidth > 0`, fallback absent, `object-fit: contain` on the padded scan) and that the missing and broken ones fall back; the render gate's `images` rule skips only images whose URL carries the expected-missing marker.
  - The book form starts with a **Cover** section: "Choose a photo" and "Take a photo" (`expo-image-picker`, with a 2:3 crop on Android and iOS; the camera asks for permission and a refusal is explained in a snackbar), and "Remove cover". On save a picked file is copied to `<documents>/covers/<bookId>.jpg` (`storeCoverFile` in `src/services/covers`); on web the picked image is kept as a `data:` URI. `BookForm` takes an optional `onFindCoverOnline`: online cover search (P02-11) plugs in there, and the button appears only once it is passed. The `book-cover-pick` journey chooses a photo through the web file picker and checks the saved book shows it, also after a reload.

### P01-11 Delete book with confirmation and undo — done

- **Description:** "Delete book" in detail overflow → `ConfirmDialog` (Booky *concerned*: "Remove 'Dune' from your shelf? Loan history for it will be removed too."). Delete runs in a transaction; a snackbar offers "Undo" for 6 s, which re-inserts the captured book graph (book, authors links, genres, group memberships, loans) with the same id.
- **Files:** `src/features/book/useDeleteBook.ts`, `src/db/repositories/books.ts` (`snapshot`, `restore`), `src/app/book/[id].tsx`.
- **Acceptance:** delete removes all dependent rows; undo restores them exactly; open-loan books show an extra warning.
- **Tests:** `src/db/repositories/__tests__/books.deleteRestore.test.ts`, `src/features/book/__tests__/useDeleteBook.test.tsx`.
- **Delivered:** the repository functions are `booksRepo.removeBook(db, id)` (snapshot, delete and orphaned-author cleanup in one transaction; returns the snapshot) and `booksRepo.restoreBook(db, snapshot)` (all or nothing; puts back the book with its id, links and loans, and re-creates any author, series, group or borrower that went missing in the meantime); `snapshotBook` is exported too. The route file is unchanged: the menu and dialog live in `BookDetailScreen`. The dialog's confirm is "Remove", its cancel "Keep it"; an open loan adds an "On loan" stamp and a sentence naming the borrower. The snackbar reads "Removed “Dune” from your shelf" with Undo for 6 s, then "“Dune” is back on your shelf". A downloaded cover file (Phase 02's `deleteCover`) is deleted only when the snackbar goes without Undo, through a new `onHide(reason)` on snackbar options.

### P01-12 Library change events and screen refresh — done

- **Description:** Tiny typed event emitter (`library-changed`, `loans-changed`, `groups-changed`, `settings-changed`) so feature hooks refresh after writes without a global store. Hooks subscribe on mount and on screen focus.
- **Files:** `src/features/events.ts`, feature hooks.
- **Acceptance:** adding/editing/deleting a book updates the Shelf without manual refresh.
- **Tests:** `src/features/__tests__/events.test.ts`, integration in `src/__tests__/shelf.test.tsx`.
- **Delivered:** built before P01-03, which uses it. `subscribe(event, fn)` returns an unsubscribe function, `emit(event)` notifies a copy of the listener list (a throwing listener is logged and the rest still run), and `useLibraryEvent(events, fn)` subscribes for the component's lifetime with the latest callback. `useShelf` and `useBook` reload on `library-changed` (the book also on `loans-changed`); the form emits `library-changed`, the delete and its Undo emit `library-changed`, `loans-changed` and `groups-changed`, and the sort emits `settings-changed`. There is no separate focus subscription: tab screens (and the Shelf under a pushed book page) are unmounted when unfocused, so they reload on every return.

---

## Test ids to add to `selectors.json`

```json
{
  "home": {
    "list": "home-list", "row": "home-row",
    "addButton": "home-add-button", "search": "home-search", "searchClear": "home-search-clear",
    "sortButton": "home-sort-button", "sortTitle": "home-sort-title", "sortAuthor": "home-sort-author",
    "sortYear": "home-sort-year", "sortAdded": "home-sort-added", "noMatches": "home-no-matches"
  },
  "bookDetail": {
    "root": "book-detail-root", "title": "book-detail-title", "authors": "book-detail-authors",
    "callNumber": "book-detail-call-number", "summary": "book-detail-summary", "readMore": "book-detail-read-more",
    "genres": "book-detail-genres", "series": "book-detail-series", "notes": "book-detail-notes",
    "edit": "book-detail-edit", "more": "book-detail-more", "delete": "book-detail-delete"
  },
  "bookForm": {
    "root": "book-form-root", "title": "book-form-title", "subtitle": "book-form-subtitle",
    "authorInput": "book-form-author-input", "authorChip": "book-form-author-chip",
    "isbn": "book-form-isbn", "publisher": "book-form-publisher", "year": "book-form-year",
    "edition": "book-form-edition", "format": "book-form-format", "pages": "book-form-pages",
    "language": "book-form-language", "genreInput": "book-form-genre-input", "genreChip": "book-form-genre-chip",
    "seriesName": "book-form-series-name", "seriesPosition": "book-form-series-position",
    "summary": "book-form-summary", "notes": "book-form-notes", "save": "book-form-save",
    "cancel": "book-form-cancel", "error": "book-form-error"
  }
}
```

The `home` group already exists (the Shelf tab's `root`, `title`, `bookCount`, `scanAction`, `askBooky`); add these keys to it. The `dialog` and `snackbar` groups come with `ConfirmDialog` and `Snackbar` in P00-30.

Repeated elements (rows, chips) share one id; tests pick by index or by contained text.

## Auto test suite journeys

Each journey is added by the card that builds its screen. Suite `core` journeys run in `smoke` (CI and the regression gate); the rest use suite `p01` (`npm run -s autotest -- journey --suite p01`).

| Journey | Suite | Steps |
|---|---|---|
| `shelf-empty` | `core` | fixture `empty`; expect `emptyState.root`, Booky bubble text |
| `shelf-demo-list` | `core` | fixture `demo`; expect 12 `home.row`; screenshot |
| `shelf-search-sort` | `p01` | fixture `demo`; search "prat" → rows contain Pratchett; sort by year; clear → 12 rows |
| `book-add-manual` | `core` | fixture `empty`; add button → fill title, author, year, genre → save → detail shows values → back → 1 row |
| `book-add-invalid-isbn` | `p01` | fill ISBN `9780000000000` → save → `bookForm.error` visible, still on form |
| `book-edit` | `p01` | fixture `demo`; open first row → edit → change year → save → detail updated |
| `book-delete-undo` | `p01` | fixture `demo`; delete → confirm → 11 rows → undo → 12 rows |
| `book-detail-missing` | `p01` | open `/book/99999`; expect `pageState.error`; the journey waives `pagestate`/`error-marker` with a reason, so render and a11y are skipped for that page |
| `book-covers` | `p01` | fixture `demo`; Pride and Prejudice's padded scan renders whole (`object-fit: contain`, no fallback); The Murder of Roger Ackroyd's broken cover and The Farthest Shore's missing one show the generated cover; Dune's real cover renders (added with P01-10) |
| `book-cover-pick` | `p01` | fixture `empty`; choose a photo in the add form (the web file picker gets a synthetic JPEG) → the preview shows it → save → the detail page shows it, also after a reload (added with P01-10) |
| `book-form-discard` | `p01` | fixture `empty`; type in the form → Cancel → the discard dialog; Escape keeps editing and returns focus to Cancel; Discard → Shelf (added with P01-07) |

All of these are in `tools/auto-test-suite/src/journeys/shelf.journey.ts` and `book.journey.ts`; `openFixture`, `waitForCount`, `waitForPath`, `waitVisible` and `rowNames` are in `helpers.ts`. The pagestate gate now counts only visible markers, since a stack keeps the screens underneath in the DOM with their own markers.

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/book-add-manual.yaml` | on device: add a book by hand using the Android keyboard, save, see it on Shelf |
| `.maestro/book-form-back-guard.yaml` | Android hardware back on a dirty form shows the discard dialog |

## Risks

| Risk | Mitigation |
|---|---|
| E2E route shipped active in production | guarded by `EXPO_PUBLIC_E2E` (inlined at build time); Jest test asserts inert behaviour; release checklist verifies |
| Slow list with thousands of books | `large` fixture + `getItemLayout`, memoised rows; FTS in P09-03 if needed |
| Form complexity on small screens | sections with sticky save button; tested at the `mobile` viewport and 200 % font scale |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + lint + typecheck + Jest
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- A user can add, view, edit, search, sort and delete books entirely offline on Android and web.
- All P01 journeys pass with `--ux-gates fail`; Maestro flows pass on an emulator.
- Regression gate green in CI.
