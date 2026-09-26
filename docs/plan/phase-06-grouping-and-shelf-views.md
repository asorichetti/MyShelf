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

### P06-01 Shelf group-by

- **Description:** Toolbar "Group by" menu: None, Genre, Series, Author, My groups. Implemented with `SectionList`; section headers styled as brass shelf edges with a count ("Fantasy · 23"). A book appears in every section it belongs to (e.g. two genres) with a stable key per section. Ungrouped books go under "No genre" / "Not in a series" / "Not in a group" at the end. Repository methods return `{ sectionKey, sectionTitle, items }[]` in one or two queries.
- **Files:** `src/db/repositories/shelfSections.ts`, `src/features/shelf/useShelf.ts`, `src/components/book/SectionHeader.tsx`, `src/app/(tabs)/index.tsx`.
- **Acceptance:** section counts match `demo`; search and sort apply within sections; series sections ordered by position.
- **Tests:** `src/db/repositories/__tests__/shelfSections.test.ts`, `src/__tests__/shelf.groupBy.test.tsx`.

### P06-02 Genre management

- **Description:** Route `src/app/genres/index.tsx`: list genres with counts; rename (collision → offer merge), merge (moves `book_genres`, keeps `user_edited = 1` if either was), delete (removes links only). Route `src/app/genres/[id].tsx` lists books in a genre.
- **Files:** `src/app/genres/index.tsx`, `src/app/genres/[id].tsx`, `src/db/repositories/genres.ts`.
- **Acceptance:** merge is a single transaction with no duplicate links; rename to an existing name triggers merge prompt.
- **Tests:** `src/db/repositories/__tests__/genres.manage.test.ts`, `src/__tests__/genres.test.tsx`.

### P06-03 Author browse and detail

- **Description:** Route `src/app/authors/index.tsx` (A–Z by `sort_name` with a fast-scroll letter index) and `src/app/authors/[id].tsx` (books by the author, grouped by series then standalone, sorted by year). Edit author name/sort name; merge duplicate authors ("J.R.R. Tolkien" + "J. R. R. Tolkien").
- **Files:** `src/app/authors/index.tsx`, `src/app/authors/[id].tsx`, `src/db/repositories/authors.ts` (`listWithCounts`, `merge`), `src/components/ui/LetterIndex.tsx`.
- **Acceptance:** merge moves `book_authors` without duplicates; letter index accessible (buttons with labels).
- **Tests:** `src/db/repositories/__tests__/authors.merge.test.ts`, `src/__tests__/authors.test.tsx`.

### P06-04 User groups repository

- **Description:** `groups` repository: `create({ name, colour, icon })`, `update`, `delete` (removes memberships only), `list()` with counts and first 3 cover URIs, `addBooks(groupId, bookIds)` (appends positions), `removeBook`, `reorder(groupId, orderedBookIds)`, `groupsForBook(bookId)`. Colours are token names from a fixed set of 8 AA-safe swatches; icons from a fixed set (heart, star, bookmark, gift, moon, sun, pen, home).
- **Files:** `src/db/repositories/groups.ts`, `src/theme/groupSwatches.ts`, `src/domain/groupIcons.ts`.
- **Acceptance:** positions contiguous after remove/reorder; duplicate add is a no-op.
- **Tests:** `src/db/repositories/__tests__/groups.test.ts`, `src/theme/__tests__/groupSwatches.test.ts` (contrast of label text on each swatch ≥ 4.5:1).

### P06-05 Groups tab

- **Description:** Groups tab shows group cards (colour band, icon, name, count, cover collage) in a 2-column grid; "New group" button → sheet with name, colour swatches, icon picker. Empty state: Booky *happy* "Groups are like little shelves — try 'Favourites'."
- **Files:** `src/app/(tabs)/groups.tsx`, `src/components/groups/GroupCard.tsx`, `src/components/groups/GroupEditorSheet.tsx`, `src/features/groups/useGroups.ts`.
- **Acceptance:** create/edit/delete from the tab; swatch and icon pickers have accessible names ("Lavender", "Heart icon").
- **Tests:** `src/features/groups/__tests__/useGroups.test.tsx`, `src/components/groups/__tests__/GroupEditorSheet.test.tsx`, `src/__tests__/groupsTab.test.tsx`.

### P06-06 Group detail and ordering

- **Description:** Route `src/app/group/[id].tsx`: books in the group in `position` order; "Reorder" mode with move-up/move-down buttons (accessible) and long-press drag as an enhancement; remove from group; add books (opens multi-select, P06-07).
- **Files:** `src/app/group/[id].tsx`, `src/features/groups/useGroup.ts`, `src/components/groups/ReorderList.tsx`.
- **Acceptance:** order persists; reorder usable with a screen reader via buttons.
- **Tests:** `src/features/groups/__tests__/useGroup.test.tsx`, `src/components/groups/__tests__/ReorderList.test.tsx`.

### P06-07 Multi-select and add to group

- **Description:** Long-press a Shelf row (or "Select" in toolbar) enters selection mode: checkboxes, count in header, actions "Add to group…", "Remove from group" (in group view), "Delete" (with confirm). Book detail also has "Groups" chips with "Add to group".
- **Files:** `src/features/shelf/useSelection.ts`, `src/components/book/SelectionBar.tsx`, `src/components/groups/GroupPickerSheet.tsx`, `src/app/book/[id].tsx`.
- **Acceptance:** selecting 3 books and adding to a group adds 3 memberships; Android back exits selection mode.
- **Tests:** `src/features/shelf/__tests__/useSelection.test.tsx`, `src/components/groups/__tests__/GroupPickerSheet.test.tsx`.

### P06-08 Shelf display modes

- **Description:** Toggle between **List** (catalogue cards), **Covers** (grid, 3 columns on phones), **Spines** (horizontal shelves of vertical spines with titles in Lora rotated 90°, colour from `hashColour`, brass shelf edges). All modes support group-by sections and selection.
- **Files:** `src/components/book/CoverGrid.tsx`, `src/components/book/SpineShelf.tsx`, `src/app/(tabs)/index.tsx`.
- **Acceptance:** each mode renders `demo` without overflow at the `mobile` viewport (390 px wide) and at 200 % font scale (spines truncate with ellipsis and full title in accessible label).
- **Tests:** `src/components/book/__tests__/CoverGrid.test.tsx`, `src/components/book/__tests__/SpineShelf.test.tsx`.

### P06-09 Persist shelf preferences

- **Description:** Settings keys `shelf.groupBy`, `shelf.viewMode`, `shelf.sort`, `shelf.filters` read on load and written on change (debounced).
- **Files:** `src/db/repositories/settings.ts`, `src/features/shelf/useShelfPrefs.ts`.
- **Acceptance:** prefs survive restart; invalid stored values fall back to defaults.
- **Tests:** `src/features/shelf/__tests__/useShelfPrefs.test.tsx`.

### P06-10 Shelf filters

- **Description:** Filter sheet: genres (multi), format, language, on loan / at home, has series, year range, "added in last 30 days". Active filters shown as removable chips under the toolbar; "Clear all".
- **Files:** `src/components/book/FilterSheet.tsx`, `src/db/repositories/books.ts` (filter clause builder), `src/domain/shelfFilters.ts`.
- **Acceptance:** filters combine with AND across types and OR within genres; SQL built with parameters only (no string concatenation of values).
- **Tests:** `src/domain/__tests__/shelfFilters.test.ts`, `src/db/repositories/__tests__/books.filters.test.ts`.

### P06-11 Browse hub

- **Description:** A "Browse" row at the top of the Shelf with chips to Genres, Series, Authors and Groups screens, so each index is one tap away.
- **Files:** `src/components/book/BrowseChips.tsx`, `src/app/(tabs)/index.tsx`.
- **Acceptance:** each chip navigates; hidden while searching.
- **Tests:** `src/components/book/__tests__/BrowseChips.test.tsx`.

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

## Auto test suite journeys

Each journey is added by the card that builds its screen. Suite `core` journeys run in `smoke` (CI and the regression gate); the rest use suite `p06` (`npm run -s autotest -- journey --suite p06`).

| Journey | Suite | Steps |
|---|---|---|
| `shelf-group-by-genre` | `core` | fixture `demo`; group by genre → 4 section headers with counts |
| `shelf-view-modes` | `p06` | switch List → Covers → Spines; screenshot each; render gate checks overflow |
| `group-create-add-books` | `core` | Groups tab → new group "Favourites" (heart, lavender) → Shelf select 3 → add to group → group shows 3 |
| `group-reorder` | `p06` | open group → reorder → move last up twice → order persisted after reload |
| `genre-merge` | `p06` | genres → rename "Sci-Fi" to "Science Fiction" → merge prompt → single genre with combined count |
| `author-browse` | `p06` | authors → letter P → Pratchett → books grouped by series |
| `shelf-filters` | `p06` | filter genre Fantasy + on loan → chips shown → clear all |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/groups-multiselect.yaml` | long-press selection, add to group, Android back exits selection |
| `.maestro/shelf-spines-scroll.yaml` | spines view scrolls smoothly with `large` fixture (no ANR), screenshot for review |

## Risks

| Risk | Mitigation |
|---|---|
| SectionList performance with `large` | windowing props, memoised rows; measured in P09-03 |
| Drag-to-reorder accessibility | buttons are the primary mechanism; drag is optional |
| Spine text illegible | min font size, AA contrast on spine colours tested, full title in label |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + typecheck + Jest (+ lint once P00-20 lands)
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- All grouping modes, user groups, view modes and filters work on Android and web.
- All P06 journeys pass with `--ux-gates fail`; Maestro flows pass.
- Regression gate green in CI.
