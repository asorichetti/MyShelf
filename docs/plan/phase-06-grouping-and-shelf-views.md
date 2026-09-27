# Phase 06 — Grouping and shelf views

## Goal

Let the user browse the collection the way they think about it: by genre, series, author, or their own groups ("Summer reading", "Signed copies", "Kids' room"), in a list of catalogue cards, a wall of covers, or a bookshelf of spines.

## Scope

- Shelf "group by" (none / genre / series / author / my groups) with section headers.
- Genre management (rename, merge, delete) and genre browse.
- Author browse and author detail.
- User groups: CRUD, membership, ordering; Groups tab.
- Shelf display modes (list, covers grid, spines) and filters; preferences persisted.

## Out of scope

- Smart/automatic groups based on rules (possible later; would need an ADR).
- Nested groups.

## Prerequisites

- Phase 01 (shelf, repositories), Phase 04 (series queries). Phase 05 for the on-loan filter.

---

## Task cards

### P06-01 Shelf group-by — done

- **Description:** Toolbar "Group by" menu: None, Genre, Series, Author, My groups. Implemented with `SectionList`; section headers styled as brass shelf edges with a count ("Fantasy · 23"). A book appears in every section it belongs to (e.g. two genres) with a stable key per section. Ungrouped books go under "No genre" / "Not in a series" / "Not in a group" at the end. The repositories already group the whole shelf (`genresRepo.groupBooksByGenre`, `seriesRepo.groupBooksBySeries`, `authorsRepo.groupBooksByAuthor`, `groupsRepo.groupBooksByGroup`, each returning `BookGroup<K>[]` with a `null` key for the ungrouped bucket); `shelfSections.ts` builds `{ sectionKey, sectionTitle, items }[]` on top of them, adding search and sort, in one or two queries per grouping.
- **Files:** `src/db/repositories/shelfSections.ts`, `src/features/shelf/useShelf.ts`, `src/components/book/SectionHeader.tsx`, `src/features/shelf/ShelfScreen.tsx`; a `brass` colour role in `src/theme/tokens.ts` for the shelf edge.
- **Acceptance:** section counts match `demo`; search and sort apply within sections; series sections ordered by position.
- **Tests:** `src/db/repositories/__tests__/shelfSections.test.ts`, `src/__tests__/shelf.groupBy.test.tsx`.
- **Delivered:** `listShelfSections` (`shelfSectionsRepo`) runs `listBookItems` (search, filters and sort in SQL, plus the author query) and one membership query per grouping, rather than calling the `groupBooksBy*` helpers, which load every book's full row and know nothing of search or filters: three queries whatever the grouping. Sections are `{ sectionKey, sectionTitle, groupBy, id, items }`; empty sections are left out; the ungrouped bucket is "No genre", "Not in a series", "No author" or "Not in a group". Books keep the Shelf's sort inside a section except series, which are in reading order (since P11-05 series sections follow the sort too; "Series reading order" gives reading order). `SectionHeader` is a level-2 heading named "Fantasy, 23 books" with a chevron that opens the genre, series, author or group page. The `brass` role already existed (Phase 01 covers), so no token was added. The Shelf is a `SectionList` in every mode (one untitled section when not grouped).

### P06-02 Genre management — done

- **Description:** Route `src/app/genres/index.tsx`: list genres with counts; rename (collision → offer merge), merge (moves `book_genres`, keeps `user_edited = 1` if either was), delete (removes links only). Route `src/app/genres/[id].tsx` lists books in a genre.
- **Files:** `src/app/genres/index.tsx`, `src/app/genres/[id].tsx`, `src/db/repositories/genres.ts`.
- **Acceptance:** merge is a single transaction with no duplicate links; rename to an existing name triggers merge prompt.
- **Tests:** `src/db/repositories/__tests__/genres.manage.test.ts`, `src/__tests__/genres.test.tsx`.
- **Delivered:** screens in `src/features/genres/` (`GenresScreen`, `GenreDetailScreen`, `useGenres`, `useGenre`). `renameGenre` throws `GenreNameTakenError` (carrying the existing genre) when the name is taken ignoring case, and the screen turns that into the merge prompt; a change of case alone is a rename. `mergeGenres` and `listGenresWithCounts` are new. Each row has Rename, "Merge into…" and Delete buttons (48 dp, named "Rename Fantasy").

### P06-03 Author browse and detail — done

- **Description:** Route `src/app/authors/index.tsx` (A–Z by `sort_name` with a fast-scroll letter index) and `src/app/authors/[id].tsx` (books by the author, grouped by series then standalone, sorted by year). Edit author name/sort name; merge duplicate authors ("J.R.R. Tolkien" + "J. R. R. Tolkien").
- **Files:** `src/app/authors/index.tsx`, `src/app/authors/[id].tsx`, `src/db/repositories/authors.ts` (`listWithCounts`, `merge`), `src/components/ui/LetterIndex.tsx`.
- **Acceptance:** merge moves `book_authors` without duplicates; letter index accessible (buttons with labels).
- **Tests:** `src/db/repositories/__tests__/authors.merge.test.ts`, `src/__tests__/authors.test.tsx`.
- **Delivered:** `authorsRepo.listAuthorsWithCounts` and `mergeAuthors` (source into target, keeping role and credit order); `authorLetter` in `src/domain/author.ts` files authors by the first letter of the sort name ("#" last). `LetterIndex` lives in `src/components/ui/` (buttons named "Jump to P"). Author detail groups books by series (A-Z, reading order) then "Standalone" by year, with edit (name and "filed under") and "Merge with another author" in the top bar. `BookListItem` gained an optional `seriesId` for this.

### P06-04 User groups repository — done

- **Description:** `groups` repository: `create({ name, colour, icon })`, `update`, `delete` (removes memberships only), `list()` with counts and first 3 cover URIs, `addBooks(groupId, bookIds)` (appends positions), `removeBook`, `reorder(groupId, orderedBookIds)`, `groupsForBook(bookId)`. Colours are token names from a fixed set of 8 AA-safe swatches; icons from a fixed set (heart, star, bookmark, gift, moon, sun, pen, home).
- **Files:** `src/db/repositories/groups.ts`, `src/theme/groupSwatches.ts`, `src/domain/groupIcons.ts`.
- **Acceptance:** positions contiguous after remove/reorder; duplicate add is a no-op.
- **Tests:** `src/db/repositories/__tests__/groups.test.ts`, `src/theme/__tests__/groupSwatches.test.ts` (contrast of label text on each swatch ≥ 4.5:1).
- **Delivered:** the repository keeps its existing names: `createGroup`, `updateGroup`, `deleteGroup`, `listGroupsWithStats` (count and first three covers, two queries), `addBooksToGroup`, `removeBooksFromGroup` / `removeBookFromGroup`, `reorderGroup`, `listGroupBookIds` and `listGroupsForBook`. The swatches (Lavender, Rose, Sage, Honey, Sky, Plum, Berry, Moss) each have a band colour and an AA label colour; unknown stored colours and icons (the demo fixture's `beach`) fall back to Lavender and Bookmark. `validateGroupName` and `moveItem` are in `src/domain/groupIcons.ts`.

### P06-05 Groups tab — done

- **Description:** Groups tab shows group cards (colour band, icon, name, count, cover collage) in a 2-column grid; "New group" button → sheet with name, colour swatches, icon picker. Empty state: Booky *happy* "Groups are like little shelves — try 'Favourites'."
- **Files:** `src/features/groups/GroupsScreen.tsx`, `src/components/groups/GroupCard.tsx`, `src/components/groups/GroupEditorSheet.tsx`, `src/features/groups/useGroups.ts`.
- **Acceptance:** create/edit/delete from the tab; swatch and icon pickers have accessible names ("Lavender", "Heart icon").
- **Tests:** `src/features/groups/__tests__/useGroups.test.tsx`, `src/components/groups/__tests__/GroupEditorSheet.test.tsx`, `src/__tests__/groupsTab.test.tsx`.
- **Delivered:** sheets use a new `Sheet` primitive (`src/components/ui/Sheet.tsx`). Edit and delete are on the group's own page (P06-06) rather than on the card.

### P06-06 Group detail and ordering — done

- **Description:** Route `src/app/group/[id].tsx`: books in the group in `position` order; "Reorder" mode with move-up/move-down buttons (accessible) and long-press drag as an enhancement; remove from group; add books (opens multi-select, P06-07).
- **Files:** `src/app/group/[id].tsx`, `src/features/groups/useGroup.ts`, `src/components/groups/ReorderList.tsx`.
- **Acceptance:** order persists; reorder usable with a screen reader via buttons.
- **Tests:** `src/features/groups/__tests__/useGroup.test.tsx`, `src/components/groups/__tests__/ReorderList.test.tsx`.
- **Partly delivered:** the group page (`GroupDetailScreen`, `useGroup`) lists books in the group's order; "Reorder" swaps in `ReorderList`, whose move-up/move-down buttons ("Move Mort up") announce the new place ("Mort moved to 2 of 3") and keep keyboard focus with the book on web; the order is saved in one transaction. "Add books" opens the Shelf picking books for this group (`/?addTo=<id>`); selecting books offers "Remove from group". **Remaining:** long-press drag, which the card lists as an optional enhancement.
- **Delivered (September 2026):** long-press drag. In Reorder mode a row lifts (primary border, slightly larger) after a 350 ms hold anywhere on it and follows the finger or mouse; the other rows slide to make room, and letting go moves the book there (`dropIndex`: the number of other rows whose middle is above the dragged row's middle). The move goes through the same `onMove` as the arrows, so it is saved in one transaction and announced ("Pride and Prejudice moved to 1 of 3"); a cancelled drag puts the row back. The hint now reads "Hold a book and drag it to its place, or use the arrows." and the move up/down buttons stay for keyboards and screen readers. Built on gesture handler's `Pan().activateAfterLongPress` with Reanimated shared values (both already in the build, see P05-04), so the drag runs on the UI thread on Android; nothing else was added. Tests: `ReorderList.test.tsx` (`dropIndex` table, a drag, a drop in place, a cancelled drag, the hold time); journey `group-drag-reorder` (p06) drags with the mouse after the hold and reloads once the save's `groups-changed` has been counted (`window.__myshelfE2e.counts`, a new E2E hook; `group-reorder` now waits the same way instead of reloading straight away); on an Android 16 emulator `scripts/maestro-suite.sh` holds and drags with `adb shell input draganddrop` (Maestro cannot) between `.maestro/group-drag-reorder.yaml` and `hooks/group-drag-check.yaml`, which checks the order, the announcement and the order after a restart (screenshots reviewed). Auto-scrolling a long group while dragging is not built: a drag reaches the rows on screen; the arrows move a book any distance.

### P06-07 Multi-select and add to group — done

- **Description:** Long-press a Shelf row (or "Select" in toolbar) enters selection mode: checkboxes, count in header, actions "Add to group…", "Remove from group" (in group view), "Delete" (with confirm). Book detail also has "Groups" chips with "Add to group".
- **Files:** `src/features/shelf/useSelection.ts`, `src/components/book/SelectionBar.tsx`, `src/components/groups/GroupPickerSheet.tsx`, `src/app/book/[id].tsx`.
- **Acceptance:** selecting 3 books and adding to a group adds 3 memberships; Android back exits selection mode.
- **Tests:** `src/features/shelf/__tests__/useSelection.test.tsx`, `src/components/groups/__tests__/GroupPickerSheet.test.tsx`.
- **Delivered:** selection works in all three display modes (items become checkboxes); the count is in `SelectionBar` at the bottom of the screen. Delete removes the books in one transaction with six seconds of Undo (`useDeleteBooks`). The book page's "Groups" section is `src/features/groups/BookGroupsSection.tsx` (group chips open the group). Android back is covered by `useSelection.test.tsx` through `BackHandler`; the Maestro flow waits for `.maestro/` (P00-18).

### P06-08 Shelf display modes — done

- **Description:** Toggle between **List** (catalogue cards), **Covers** (grid, 3 columns on phones), **Spines** (horizontal shelves of vertical spines with titles in Lora rotated 90°, colour from `hashColour`, brass shelf edges). All modes support group-by sections and selection.
- **Files:** `src/components/book/CoverGrid.tsx`, `src/components/book/SpineShelf.tsx`, `src/features/shelf/ShelfScreen.tsx`.
- **Acceptance:** each mode renders `demo` without overflow at the `mobile` viewport (390 px wide) and at 200 % font scale (spines truncate with ellipsis and full title in accessible label).
- **Tests:** `src/components/book/__tests__/CoverGrid.test.tsx`, `src/components/book/__tests__/SpineShelf.test.tsx`.
- **Partly delivered:** List, Covers (3 columns on phones, real covers via `CoverImage`'s new `width`, the generated cover only as a fallback) and Spines (48–60 dp wide by title hash, Lora title turned 90° with an ellipsis, cover-palette colours, brass shelf edge) all support sections and selection, and pass the render gate at 390 px with `demo` (`shelf-view-modes`). **Remaining:** the 200 % font scale check on a device; the web build cannot scale fonts, and Jest only proves the one-line ellipsis and the full-title label. *Update (P09-10):* checked on an Android 16 emulator at `font_scale` 2.0 (`.maestro/font-scale.yaml`): List, Covers and Spines lay out without clipping or overlap, spine titles keep one line with an ellipsis, and the screenshots were reviewed; `shelf-spines-scroll.yaml` scrolls the spines and covers with the `large` fixture.

### P06-09 Persist shelf preferences — done

- **Description:** Settings keys `shelfGroupBy`, `shelfViewMode`, `shelfSort` (from P01-04) and `shelfFilters` read on load and written on change (debounced).
- **Files:** `src/domain/settings.ts` (keys and defaults), `src/features/shelf/useShelfPrefs.ts`.
- **Acceptance:** prefs survive restart; invalid stored values fall back to defaults.
- **Tests:** `src/features/shelf/__tests__/useShelfPrefs.test.tsx`.
- **Delivered:** sort, grouping and display mode are single taps and are saved at once; filters, which change tap by tap, are debounced (300 ms). Anything pending is saved when the app goes to the background or the Shelf unmounts. Invalid stored values fall back to defaults (`parseShelfSort`, `parseShelfGroupBy`, `parseShelfViewMode`, `parseShelfFilters`).

### P06-10 Shelf filters — done

- **Description:** Filter sheet: genres (multi), format, language, on loan / at home, has series, year range, "added in last 30 days". Active filters shown as removable chips under the toolbar; "Clear all".
- **Files:** `src/components/book/FilterSheet.tsx`, `src/db/repositories/books.ts` (filter clause builder), `src/domain/shelfFilters.ts`.
- **Acceptance:** filters combine with AND across types and OR within genres; SQL built with parameters only (no string concatenation of values).
- **Tests:** `src/domain/__tests__/shelfFilters.test.ts`, `src/db/repositories/__tests__/books.filters.test.ts`.
- **Delivered:** `booksRepo.filterClause` builds the WHERE condition with bound parameters only, and `listFilterOptions` offers only values some book has. The sheet shows genres with counts, on loan / at home, in a series / standalone, format, language, a year range and "added in the last 30 days"; changes apply at once. "Nothing matches these filters" has a "Clear filters" action. **Later:** genre and series ids can be given again after a delete (SQLite's next id is the highest plus one), so a saved genre filter, or Booky's memory of a series tip (`series-gap:<id>`), silently applied to whatever took the id next. Deleting or merging a genre or series now forgets its id in the same transaction (`settingsRepo.forgetEntities`; a merged genre's filter follows it into the target), and reading a setting drops ids that no longer exist. Groups and authors are named by no setting. Those four tables keep plain `INTEGER PRIMARY KEY`: with the ids forgotten on delete, reuse is harmless, and rebuilding them (three carry search index triggers) would be risk for no gain.

### P06-11 Browse hub — done

- **Description:** A "Browse" row at the top of the Shelf with chips to Genres, Series, Authors and Groups screens, so each index is one tap away.
- **Files:** `src/components/book/BrowseChips.tsx`, `src/features/shelf/ShelfScreen.tsx`.
- **Acceptance:** each chip navigates; hidden while searching.
- **Tests:** `src/components/book/__tests__/BrowseChips.test.tsx`.
- **Delivered:** Groups is the Groups tab; Series links to the Phase 04 routes.

---

## Test ids to add to `selectors.json`

```json
{
  "shelfView": {
    "groupByButton": "shelf-group-by-button", "groupByNone": "shelf-group-by-none", "groupByGenre": "shelf-group-by-genre",
    "groupBySeries": "shelf-group-by-series", "groupByAuthor": "shelf-group-by-author", "groupByGroup": "shelf-group-by-group",
    "sectionHeader": "shelf-section-header", "modeList": "shelf-mode-list", "modeCovers": "shelf-mode-covers",
    "modeSpines": "shelf-mode-spines", "filterButton": "shelf-filter-button", "filterChip": "shelf-filter-chip",
    "filterClear": "shelf-filter-clear", "browseGenres": "shelf-browse-genres", "browseSeries": "shelf-browse-series",
    "browseAuthors": "shelf-browse-authors", "browseGroups": "shelf-browse-groups"
  },
  "selection": { "bar": "selection-bar", "count": "selection-count", "addToGroup": "selection-add-to-group", "remove": "selection-remove", "delete": "selection-delete", "checkbox": "selection-checkbox" },
  "genres": { "root": "genres-root", "row": "genres-row", "rename": "genres-rename", "merge": "genres-merge", "delete": "genres-delete" },
  "authors": { "root": "authors-root", "row": "authors-row", "letter": "authors-letter", "detail": "author-detail-root", "merge": "authors-merge" },
  "groups": {
    "root": "groups-root", "title": "groups-title", "card": "groups-card", "new": "groups-new",
    "editorName": "groups-editor-name", "editorSwatch": "groups-editor-swatch", "editorIcon": "groups-editor-icon",
    "editorSave": "groups-editor-save", "detail": "group-detail-root", "reorder": "group-reorder",
    "moveUp": "group-move-up", "moveDown": "group-move-down", "addBooks": "group-add-books", "pickerOption": "group-picker-option"
  }
}
```

(`groups.root`/`groups.title` exist from P00-11 — extend the group.)

As built, `selectors.json` also has the ids the screens needed beyond this list: `shelfView` (cover cells, spines, Select, the filter sheet's options and chip remove buttons), `selection.cancel`, `genres` (rename field, merge options, genre page), `authors` (edit sheet, merge options, detail sections) and `groups` (editor sheet, edit, delete, picker, reorder rows, book-page chips). The code is the reference.

## Auto test suite journeys

Each journey is added by the card that builds its screen. Suite `core` journeys run in `smoke` (CI and the regression gate); the rest use suite `p06` (`npm run -s autotest -- journey --suite p06`).

| Journey | Suite | Steps |
|---|---|---|
| `shelf-group-by-genre` | `p06` | fixture `demo`; group by genre → 4 section headers with counts; group by series → the sort inside each series (P11-05) |
| `shelf-view-modes` | `p06` | switch List → Covers → Spines; screenshot each; render gate checks overflow; spines grouped by genre |
| `shelf-filters` | `p06` | filter genre Fantasy + on loan → chips shown → remove one → clear all |
| `shelf-prefs-persist` | `p06` | group by author, Covers, sort by year, a genre filter → all survive a reload |
| `browse-hub` | `p06` | each Browse chip opens its index with one h1; the chips hide while searching |
| `group-create-add-books` | `p06` | Groups tab → new group "Favourites" (heart, lavender) → Shelf select 3 → add to group → group shows 3 → book page lists it |
| `group-reorder` | `p06` | open group → reorder → move last up twice (once by keyboard) → order persisted after reload → Add books from the Shelf |
| `genre-merge` | `p06` | tag Dune "Sci-Fi" → genres → rename "Sci-Fi" to "Science Fiction" → merge prompt → single genre with combined count |
| `author-browse` | `p06` | authors → letter P → Pratchett → books grouped by series |

All nine are in suite `p06` (the two planned for `core` too, so the regression gate's `smoke` stays unchanged while the phase is in flight).

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/groups-multiselect.yaml` | long-press selection, add to group, Android back exits selection |
| `.maestro/shelf-spines-scroll.yaml` | spines view scrolls smoothly with `large` fixture (no ANR), screenshot for review |

Both pass on an Android 16 emulator ([`docs/device-testing.md`](../device-testing.md)); `sort-filter.yaml` adds the Sort sheet's Library order and the On loan filter, and `font-scale.yaml` the three views at 200 % text.

## Risks

| Risk | Mitigation |
|---|---|
| SectionList performance with `large` | windowing props, memoised rows; measured in P09-03 |
| Drag-to-reorder accessibility | buttons are the primary mechanism; drag is optional |
| Spine text illegible | min font size, AA contrast on spine colours tested, full title in label |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + lint + typecheck + Jest
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- All grouping modes, user groups, view modes and filters work on Android and web.
- All P06 journeys pass with `--ux-gates fail`; Maestro flows pass.
- Regression gate green in CI.
