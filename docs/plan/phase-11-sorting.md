# Phase 11 — Sorting

## Goal

Let people sort the Shelf however they actually want to: by genre, then author, then series, or by any of a dozen other keys, up to four levels deep, each level with its own direction. Presets give the common orders in one tap ("Library order", "Series reading order", "Call number" and a few playful ones: "Rainbow", "Surprise me"); anyone can save their own, and the order they pick is kept.

## Scope

- A sort model of one to four levels, `{ key, direction }` each, with title then id as the final tiebreaker.
- One key registry: each key's label, direction names, SQL and joins.
- Keys: title, author, series, number in series, genre, year, date added, last edited, page count, publisher, language, format, on loan, borrower, group, title length, spine colour, call number, rating and a seeded shuffle.
- Built-in presets and saved, named presets (rename, delete).
- A Sort sheet reached from the Shelf's sort button, accessible by keyboard and screen reader; a readable summary on the Shelf.
- Grouping and sorting together: sections in the grouping's order, the sort inside each.
- Old single-key sort settings (the Shelf menu, Preferences, old backups) read as the same order.
- Every preset's Shelf query under 100 ms with 10,000 books on the web build.

## Out of scope

- Dragging levels (move up and move down buttons do the job for every input method).
- Real cover-photo colours: SQLite cannot see an image, so "Rainbow" uses the colour the app gives each spine.
- Per-group or per-screen sorts (author, genre and group pages keep their own orders).

## Prerequisites

- Phases 01, 06 and 08 (Shelf, grouping and preferences), P09-03 (the search index and the `huge` fixture) and Phase 10 (the rating column).

---

## Task cards

### P11-01 Sort model and key registry — done

- **Description:** Replace the single `{ sort, direction }` with `ShelfSort = { levels: SortLevel[1..4], seed? }`. One module defines every key: label, hint, default direction, direction names, the SQL value and the joins it reads. `ORDER BY` puts unknown values last in both directions and ends with title, then id.
- **Files:** `src/domain/shelfSort.ts`, `src/db/sortKeys.ts`, `src/db/repositories/{books,shelfSections}.ts`, `src/domain/{book,shelfView,settings,index}.ts`.
- **Acceptance:** every key is testable on its own; ties always resolve the same way; no SQL outside `src/db`.
- **Tests:** `src/db/__tests__/sortKeys.test.ts`, `src/domain/__tests__/shelfSort.test.ts`.
- **Delivered:** `sortKeyIds` and the pure model (parsing, presets, level editing, section rules, the shuffle's TypeScript twin) are in `src/domain/shelfSort.ts`; the registry is `src/db/sortKeys.ts` (`sortKeyRegistry`, `sortKeyList`, `buildSortSql`, `describeSort`). `SortKeyInfo` (the label half of a key) is a domain type, so the Sort sheet can be given the keys without importing the database layer. Unknown values last without evaluating a value twice (a correlated subquery would run twice): ascending, `COALESCE(value, x'FFFFFFFF')` sorts a NULL after every number, text and three-byte rank; descending, NULL already sorts last. Text keys are accent-folded (`foldSql`: the common accented Latin letters, ß, æ, œ, ø, ł, þ, ð, the same letters `stripDiacritics` folds) and compared `COLLATE NOCASE`; the fold runs only on values with a non-ASCII character (one `GLOB` for the rest). "Date added" breaks its own ties by id in the same direction (a fixture adds many books in one millisecond). `listBookItems` takes `sort: ShelfSort` and builds its `ORDER BY` only from the registry.

### P11-02 The keys — done

- **Description:** Title (leading The/A/An ignored), author (first author's sort name), series, number in series (numeric), genre (primary genre, documented), year, date added, last edited, page count, publisher, language, format, on loan, borrower, group, title length, spine colour, call number, rating and "Surprise me".
- **Files:** `src/db/sortKeys.ts`, `src/theme/coverOrder.ts`.
- **Acceptance:** on a crafted library: "The Hobbit" under H, "Émile" between "Eagle" and "Ezra", 2.5 between 2 and 3 and 10 after 3, a co-written book under its first author, NULLs last both ways.
- **Tests:** `src/db/__tests__/sortKeys.test.ts` (one test per key, both directions), `src/theme/__tests__/coverOrder.test.ts`.
- **Delivered:**
  - **Primary genre:** a book has no main genre of its own, so it is the first of its genres alphabetically (ignoring case). That is the order the book page lists them in, and so the genre its call number's class comes from. "The Hound of the Baskervilles" (Mystery, Classics) files under Classics.
  - **Author** is the first credited author's sort name ("Pratchett, Terry"); **group** is the first of a book's groups alphabetically; **language** sorts by English name ("German" before "Swedish"); **format** runs hardback, paperback, e-book, audiobook, with "other" and unknown last; **on loan** puts books out now first (a returned loan does not count); **borrower** is who has it now; **title length** counts characters.
  - **Spine colour** ("Rainbow") is the generated binding `hashColour(title)` picks, the colour of every spine and of a cover drawn without a photo. It is not the cover photo's colour, which SQLite cannot see. The bindings are placed round the colour wheel from red (`rainbowRanks` in `src/theme/coverOrder.ts`). The Shelf passes its theme's order to the query (`coverOrder`), so the rainbow follows the colours on screen in light and dark.
  - **Call number** is exactly what the book page prints ("FIC PRA 1983"), ordered by class, then author mark, then year.
  - Spine colour and call number are worked out in TypeScript for the whole library just before the query (`rank`). They are handed to SQLite as one BLOB of three-byte ranks indexed by book id, which `substr` reads in constant time. A book added in between sorts last rather than breaking the query.
  - **Surprise me** is a seeded integer hash of the id in SQL (golden-ratio step plus the seed, one xor-shift-multiply round, XOR written as `(a | b) - (a & b)`). A test checks it against `shuffleRank` for 500 ids and four seeds.
  - **Rating** (Phase 10's column) is a registry key: highest first, unrated last.

### P11-03 The Sort sheet — done

- **Description:** The shared `Sheet`, opened from the Shelf's sort button. Preset chips at the top. Then the levels as rows ("Sort by", "Then by…"), each with a key picker, a direction toggle named in words, move up, move down and remove, plus "Add a level". "Save as preset". A readable summary on the Shelf. Keyboard and screen reader throughout, 48 dp targets, light and dark.
- **Files:** `src/components/book/{SortSheet,ShelfToolbar}.tsx`, `src/features/shelf/ShelfScreen.tsx`, `src/testing/selectors.json`.
- **Acceptance:** a three-level sort can be built with the keyboard alone; moving a level keeps focus on it; every control is named ("Move Author up", "Author order: A to Z. Reverse").
- **Tests:** `src/components/book/__tests__/{SortSheet,ShelfToolbar}.test.tsx`, `src/__tests__/shelf.search.test.tsx`; journeys `sort-library-order`, `sort-keyboard-three-levels`, `sort-sheet-dark`.
- **Delivered:**
  - The sort button now reads "Sort: Library order" (the preset's name, or a single level such as "Year published (Newest first)", or "Custom"). Its accessible name carries the whole sort, and it reports the open sheet with `aria-expanded`. The inline sort menu is gone.
  - A caption under the toolbar (`home.sortSummary`) says "Sorted by Genre, then Author, then Series, then Number in series". A direction other than a key's natural one is named: "Date added (Oldest first)".
  - Each level is a list item named "Level 2: Then by Author, Z to A". The key button opens an inline radio group of the keys not used by another level. After a move, focus follows the level (the other arrow at an end), and a polite live region says "Author moved to level 1 of 3". "Add a level" stops at four. The last level cannot be removed. A shuffle has no direction button, and "Shuffle again" appears instead.
  - Title is always the final tiebreaker, and the sheet says so ("Books still tied after the last level go by title.").

### P11-04 Presets and saved presets — done

- **Description:** Built-in presets: Library order, Series reading order, Call number, Newest additions, A–Z by title, By author, Rainbow, Surprise me. The user can save the current sort under a name, and rename or delete saved presets.
- **Files:** `src/domain/{shelfSort,settings}.ts`, `src/features/shelf/{useShelfPrefs,useShelf}.ts`, `src/components/book/SortSheet.tsx`.
- **Acceptance:** each preset gives its documented order on the demo library; a saved preset survives a reload; names are unique (built-in names included) and not blank.
- **Tests:** `src/db/repositories/__tests__/sortPresets.test.ts`, `src/domain/__tests__/shelfSort.test.ts`, `src/features/shelf/__tests__/useShelfPrefs.test.tsx`; journeys `sort-save-preset-reload`, `sort-surprise-stable`.
- **Delivered:**
  - Library order is genre, author, series, number in series. The title that completes it is the universal tiebreaker, so it fits in four levels. By author is author, series, number, year.
  - Saved presets are the setting `shelfSortPresets`, a list of `{ id, name, levels }` (at most 20, names up to 40 characters). They are part of the settings a backup carries. "Save as preset" is off while the sort already is a preset. Rename happens in place. Delete is immediate and announced.
  - "Surprise me" deals a new seed each time it is chosen. The seed is saved with the sort, so the order stays the same across leaving the Shelf and reloads until "Shuffle again".

### P11-05 Grouping and sorting together — done

- **Description:** When grouped, sections come in the grouping's order and the sort applies within each. A first level that is the grouping's own key is skipped inside the sections, and the summary says so.
- **Files:** `src/domain/shelfSort.ts` (`sectionSort`, `groupSortKey`, `groupSectionDirection`), `src/db/repositories/shelfSections.ts`.
- **Acceptance:** Library order grouped by genre: genre sections A to Z, author then series inside; "Genre (as sections), then Author…".
- **Tests:** `src/db/repositories/__tests__/{sortPresets,shelfSections}.test.ts`, `src/domain/__tests__/shelfSort.test.ts`; journey `sort-grouped-by-genre`.
- **Delivered:**
  - The skipped level's direction orders the sections: genre Z to A reverses them, with the ungrouped section still last. Rating sections run best first on their own, so "Rating, lowest first" reverses those.
  - **Changed from P06-01:** series sections used to list their books in reading order whatever the sort. They now follow the sort like every other section. "Series reading order" (series, then number), grouped by series, skips the series level and gives reading order.
  - The Sort sheet explains the skipped level ("Grouped by genre: Genre orders the sections, so inside them the next level decides.").
  - Section names are ordered accent-folded too.

### P11-06 Keeping the sort, and old settings — done

- **Description:** Persist the active sort. A sort saved before this phase (the Shelf's menu and Preferences both wrote `{ sort, direction }`; old backups carry it) reads as the same order. The Preferences screen's default sort works with the new model.
- **Files:** `src/domain/shelfSort.ts` (`parseShelfSort`, `isLegacySort`), `src/features/shelf/useShelfPrefs.ts`, `src/features/settings/{preferenceOptions,PreferencesScreen,SettingsScreen}.tsx`.
- **Acceptance:** `{ sort: 'year', direction: 'desc' }` opens as "Year published, newest first" on the Shelf and in Preferences; invalid values fall back to title order.
- **Tests:** `src/features/shelf/__tests__/useShelfPrefs.test.tsx`, `src/__tests__/{preferences,settingsTab,corruptData}.test.tsx`, `src/domain/__tests__/shelfSort.test.ts`.
- **Delivered:**
  - The setting key is still `shelfSort`, now `{ levels, seed? }`. The old shape (title, author, year, added, and Phase 10's rating) becomes one level with the same direction. It is rewritten in the new shape the first time the Shelf reads it, once.
  - Preferences' "Sort the shelf by" lists the built-in presets, the user's saved presets and the old single-key orders ("Year, newest first", "Rating, lowest first" …). When the Shelf's sort is none of those, it adds a "Custom: …" entry. Choosing a preset there applies it as the Sort sheet does.

### P11-07 Performance with 10,000 books — done

- **Description:** Use indexed columns where possible; each preset's query well under 100 ms on the web build with the `huge` fixture; a perf journey for multi-key sorts.
- **Files:** `src/db/sortKeys.ts`, `tools/auto-test-suite/src/journeys/performance.journey.ts`.
- **Acceptance:** `shelf-huge-multisort` passes, and its numbers are recorded here.
- **Delivered:**
  - Every key reads either a column of `books`, the already-joined series and open loan, or one correlated lookup through a primary-key or indexed join (`book_authors`, `book_genres`, `group_books`). Only the correlated lookups and the fold add cost.
  - Candidate extra indexes (`book_authors(book_id, position)`, `genres(name NOCASE)`) were measured and gained under 3 ms, so no migration was added.
  - Most of the Shelf query is the fixed cost of reading and building 10,000 rows: about 50 ms for "A–Z by title", which adds only the title fold.
  - The shuffle is one hash round (two cost 20 ms more). Spine colours are remembered per title and call numbers per genre, author and year.
  - Web build, `huge` fixture, three runs each (`shelf-huge-multisort`, September 2026, a laptop):

  | Preset | Query (ms), median | Runs |
  |---|---|---|
  | Library order | 80.8 | 80.8, 81.6, 79.3 |
  | Series reading order | 53.2 | 54.8, 49.3, 53.2 |
  | Call number | 82.7 | 81.9, 83.6, 82.7 |
  | Newest additions | 49.5 | 49.5, 46.6, 52.1 |
  | A–Z by title | 51.6 | 45.5, 51.6, 55.1 |
  | By author | 64.7 | 64.7, 64.6, 67.8 |
  | Rainbow | 60.0 | 65.9, 59.7, 60.0 |
  | Surprise me | 51.1 | 50.9, 51.1, 52.2 |
  | Library order, grouped by genre | 78.1 | one run |

  Every preset is under the 100 ms budget. The two heaviest, Library order and Call number, spend about 30 ms on top of the fixed cost. Library order does two correlated lookups per book (primary genre, first author); Call number works out every book's call number in TypeScript.

---

## Test ids added to `selectors.json`

`home.sortTitle`, `home.sortAuthor`, `home.sortYear`, `home.sortAdded`, `home.sortRating` and `home.sortDirection` went with the inline menu.

```json
{
  "home": { "sortSummary": "home-sort-summary" },
  "sortSheet": {
    "root": "sort-sheet-root", "status": "sort-sheet-status", "preset": "sort-sheet-preset", "reshuffle": "sort-sheet-reshuffle",
    "savedPreset": "sort-sheet-saved-preset", "savedRename": "sort-sheet-saved-rename", "savedDelete": "sort-sheet-saved-delete",
    "renameField": "sort-sheet-rename-field", "renameSave": "sort-sheet-rename-save", "renameCancel": "sort-sheet-rename-cancel",
    "groupNote": "sort-sheet-group-note", "level": "sort-sheet-level", "levelKey": "sort-sheet-level-key", "levelKeyOption": "sort-sheet-level-key-option",
    "levelDirection": "sort-sheet-level-direction", "levelUp": "sort-sheet-level-up", "levelDown": "sort-sheet-level-down", "levelRemove": "sort-sheet-level-remove",
    "addLevel": "sort-sheet-add-level", "savePreset": "sort-sheet-save-preset", "presetName": "sort-sheet-preset-name",
    "presetSave": "sort-sheet-preset-save", "presetCancel": "sort-sheet-preset-cancel", "done": "sort-sheet-done"
  }
}
```

## Auto test suite journeys

Suite `p11` (`npm run -s autotest -- journey --suite p11`), gates set to fail; one journey in `perf`.

| Journey | Suite | Steps |
|---|---|---|
| `sort-library-order` | `p11` | demo; the Library order preset → the 12 rows in exact order; four named levels; "Sort: Library order" and the summary; screenshots of the sheet and the shelf |
| `sort-keyboard-three-levels` | `p11` | keyboard only: Enter opens the sheet; Tab, Space and Enter build On loan → Author (Z to A) → Year (newest first); Move up/down keep focus on the level; Escape closes; exact row order |
| `sort-save-preset-reload` | `p11` | build "Page count, longest first", save it as "Doorstops", switch to A–Z; Preferences lists "Doorstops" (read back from the database); reload; apply it from "Your presets"; exact row order |
| `sort-surprise-stable` | `p11` | Surprise me shuffles; the same order after leaving for Settings (which reads the sort back) and after a reload; "Shuffle again" changes it |
| `sort-grouped-by-genre` | `p11` | grouped by genre + Library order: sections A to Z, author order inside (Mystery: Christie, Christie, Conan Doyle); the grouping note and "(as sections)" summary; Genre Z to A reverses the sections |
| `sort-sheet-dark` | `p11` | dark scheme: a saved preset, Library order; gates (contrast) on the sheet and the shelf; screenshots |
| `sort-rainbow-spines` | `p11` | Rainbow on the Spines view: spine hues never go backwards round the wheel |
| `shelf-huge-multisort` | `perf` | huge (10,000 books): every preset three times and Library order grouped by genre, each Shelf query under 100 ms (grouped: 150 ms); `timing.json` |

`shelf-search-sort` (p01), `shelf-prefs-persist` and the series step of `shelf-group-by-genre` (p06), and `rating-sort-filter` and `rating-dark` (p10) now sort from the sheet.

## Risks

| Risk | Mitigation |
|---|---|
| Accented names sort after Z (SQLite's NOCASE folds ASCII only) | `foldSql` replaces accented letters, only in non-ASCII values; tested against `stripDiacritics` |
| A computed key (call number, colour) drifts from what the screen shows | both call the app's own functions (`callNumber`, `hashColour`) on the same data the screens use; a test compares with the book page's call numbers |
| Four levels of correlated subqueries get slow on big libraries | measured per preset on 10,000 books in the perf suite |
| Old settings or backups with the single-key sort | `parseShelfSort` reads both shapes; the old one is rewritten once |

## Regression gate

As every phase: `npm run check`, `npm run autotest:check`, `npm run autotest:selftest`, and every journey (bar `live` and `perf`) with `--ux-gates fail` against the web export; `perf` once for the numbers above.

## Exit criteria

- Every card above ticked in `STATUS.md`; `p11` journeys green with gates enforced; `shelf-huge-multisort` under budget.
