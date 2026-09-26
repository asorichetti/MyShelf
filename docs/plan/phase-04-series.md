# Phase 04 — Series

## Goal

Books know which series they belong to and where they sit in it. The user can see each series in order, spot missing volumes, track progress ("5 of 9 owned") and fix series data that the metadata providers got wrong.

## Scope

- Series repository operations (create, rename, merge, delete, total count).
- Series picker in the book form; confirmation of auto-detected series on save.
- Series list and series detail screens with gap spines.
- "Next in series" and progress on book detail.

## Out of scope

- Fetching complete series lists from an online source (no reliable free API; `total_count` is user-entered or inferred from the highest position owned).
- Group-by-series on the Shelf (P06-01 reuses this phase's queries).

## Prerequisites

- Phase 01 (book form/detail) and Phase 02 (`extractSeries`).

---

## Task cards

### P04-01 Series repository — done

- **Description:** `series` repository: `list()` with counts (`owned`, `maxPosition`, `total_count`), `get(id)` with books ordered by `series_position` (nulls last, then title), `findOrCreate(name)` (case- and article-insensitive match via `normaliseTitle`), `rename`, `setTotalCount`, `merge(sourceId, targetId)` (moves books, deletes source, in a transaction), `delete(id)` (books keep existing, `series_id` → null). `gaps(seriesId)` returns missing integer positions from 1 to `max(total_count, maxPosition)`.
- **Files:** `src/db/repositories/series.ts`, `src/domain/seriesGaps.ts`.
- **Acceptance:** merge preserves positions; gaps ignore fractional positions (2.5 is a bonus, not a gap-filler); "The Expanse" and "Expanse" resolve to the same series.
- **Tests:** `src/db/repositories/__tests__/series.test.ts`, `src/domain/__tests__/seriesGaps.test.ts`.
- **Delivered:** the repository keeps its `…Series` naming (`seriesRepo.createSeries`, `getSeries`, `listSeries`, `deleteSeries`, `setBookSeries` existed from P00-14). Added: `listSeriesWithStats(db, { sort: 'name' | 'recent' })` returning `SeriesSummary` (`bookCount`, `owned`, `maxPosition`, `total`, `missing`, `lastAddedAt`), `getSeriesWithBooks(id)`, `renameSeries`, `setSeriesTotalCount` (whole number above 0 or null, else `RangeError`), `mergeSeries(sourceId, targetId)` (one transaction; the target keeps its total or takes the source's; returns null for a missing or identical series) and `seriesGapsFor(id)`. `findSeriesByName` / `findOrCreateSeries` now match on `normaliseText` (case, accents, punctuation, leading article), because `normaliseTitle` does not exist; the oldest near-duplicate wins. The pure rules are in `src/domain/seriesGaps.ts`: `seriesGaps`, `seriesLength` and `seriesProgress`. The run is 1…max(`total_count`, highest position rounded down): a 2.5 fills no gap and does not count as owned, but implies a #2. `owned` counts distinct whole positions, so "5 of 9 owned, 2 missing" always adds up; `bookCount` counts every linked book. `complete` needs a user-set total.

### P04-02 Series picker in the book form

- **Description:** Replace P01's free-text series fields with `SeriesInput`: search existing series, create new inline, position number field (accepts `3`, `3.5`, `III`), "Not part of a series" clear action. Shows "Suggested: Discworld #5" chip when the draft came from a candidate with a series hint; tapping accepts it.
- **Files:** `src/components/book/SeriesInput.tsx`, `src/components/book/BookForm.tsx`, `src/domain/seriesPosition.ts` (parse/format; roman numerals).
- **Acceptance:** positions round-trip (`2.5` shown as "2.5", `5` as "5"); suggestion chip only when a hint exists.
- **Tests:** `src/components/book/__tests__/SeriesInput.test.tsx`, `src/domain/__tests__/seriesPosition.test.ts`.
- **Partly delivered:** `src/domain/seriesPosition.ts` is done: `parseSeriesPosition` accepts `3`, `#3`, `3.5`, `3,5`, `2½`, `III`, `Book 3`, `vol. 2`, `Part Two` and `Book 3 of 9`, reusing `parsePosition` and the `POSITION_KEYWORD` list from `seriesParser.ts` (now exported) so the form and the metadata parser agree; `formatSeriesPosition` (`5` → "5", `2.5` → "2.5", float noise rounded to three places; round-trips), `formatSeriesLabel` ("Discworld #5" for the suggestion chip) and `isValidSeriesPosition`. **Remaining:** `SeriesInput.tsx`, its `BookForm` wiring, the suggestion chip, the `seriesInput` test ids and `SeriesInput.test.tsx`.

### P04-03 Confirm detected series on save

- **Description:** When saving from a candidate (P03-09, P02-11) with a series hint of confidence < high, show an inline confirmation on the detail page: "Is this Discworld #5?" with Yes / Change / Not a series. High-confidence hints (Open Library `series` with a position) are applied directly but still editable.
- **Files:** `src/components/book/SeriesConfirm.tsx`, `src/features/book/useSeriesConfirm.ts`.
- **Acceptance:** "Yes" keeps the link and hides the prompt; "Change" opens `SeriesInput`; "Not a series" clears `series_id` and records the book id in the settings key `series.dismissedBookIds` so the prompt never reappears for that book (and a later "Refresh details" does not re-add the series).
- **Tests:** `src/features/book/__tests__/useSeriesConfirm.test.tsx`.

### P04-04 Series list screen

- **Description:** Route `src/app/series/index.tsx`, reachable from Shelf group-by (P06-01) and from book detail. Each row: series name, a mini row of spines (owned = filled, missing = dashed), "5 of 9" progress. Sort by name or most recent addition. Empty state with Booky.
- **Files:** `src/app/series/index.tsx`, `src/components/series/SeriesRow.tsx`, `src/components/series/MiniSpines.tsx`, `src/features/series/useSeriesList.ts`.
- **Acceptance:** counts match `demo`; accessible label "Discworld, 5 of 9 owned, 2 missing".
- **Tests:** `src/__tests__/seriesList.test.tsx`, `src/components/series/__tests__/SeriesRow.test.tsx`.

### P04-05 Series detail screen

- **Description:** Route `src/app/series/[id].tsx`: header with name, progress bar, total-count editor ("How many books are in this series?"); ordered list of books as spines on a brass shelf, with dashed placeholder spines for gaps labelled "#2 missing" (tap → "Add #2" opens scan or manual add with series prefilled). Actions: rename, merge into another series, delete series.
- **Files:** `src/app/series/[id].tsx`, `src/components/series/SeriesShelf.tsx`, `src/components/book/Spine.tsx`, `src/features/series/useSeries.ts`.
- **Acceptance:** gaps rendered in order; merge flow with picker and confirmation; rename updates everywhere.
- **Tests:** `src/__tests__/seriesDetail.test.tsx`, `src/components/book/__tests__/Spine.test.tsx`.

### P04-06 Series on book detail

- **Description:** Book detail series section links to the series screen and shows "Book 5 of 9", "Previous: …" and "Next: …" (next owned or "#6 not on your shelf yet").
- **Files:** `src/components/book/SeriesSection.tsx`, `src/app/book/[id].tsx`, `src/db/repositories/series.ts` (`neighbours(bookId)`).
- **Acceptance:** first/last book edge cases; fractional positions ordered correctly.
- **Tests:** `src/db/repositories/__tests__/series.neighbours.test.ts`, `src/components/book/__tests__/SeriesSection.test.tsx`.

### P04-07 Series gap tip

- **Description:** Publish a `series-gap` event when a save creates or reveals a gap; Booky (*thinking*) says "You have #1 and #3 of Discworld — #2 is missing." once per series (tip id `series-gap:<seriesId>`). The rules engine consumes it in P07-02; until then call `useBooky().showTip` directly.
- **Files:** `src/features/series/seriesEvents.ts`, `src/features/scan/useSaveCandidate.ts`.
- **Acceptance:** tip appears once per series; not shown in Quiet mode (after P07-06).
- **Tests:** `src/features/series/__tests__/seriesEvents.test.ts`.

### P04-08 Series completion celebration

- **Description:** When a save makes owned = `total_count` with no gaps, Booky (*excited*) "Series complete! All 9 Discworld books." and a one-time confetti of tiny bookmarks (skipped with reduce-motion).
- **Files:** `src/features/series/seriesEvents.ts`, `src/components/booky/Celebration.tsx`.
- **Acceptance:** fires once per series completion; not re-fired on edits that keep it complete.
- **Tests:** `src/features/series/__tests__/completion.test.ts`, `src/components/booky/__tests__/Celebration.test.tsx`.

---

## Test ids to add to `selectors.json`

```json
{
  "seriesInput": {
    "search": "series-input-search", "option": "series-input-option", "create": "series-input-create",
    "position": "series-input-position", "clear": "series-input-clear", "suggestion": "series-input-suggestion"
  },
  "seriesConfirm": { "root": "series-confirm-root", "yes": "series-confirm-yes", "change": "series-confirm-change", "no": "series-confirm-no" },
  "seriesList": { "root": "series-list-root", "row": "series-list-row" },
  "seriesDetail": {
    "root": "series-detail-root", "title": "series-detail-title", "progress": "series-detail-progress",
    "spine": "series-detail-spine", "gap": "series-detail-gap", "totalCount": "series-detail-total-count",
    "rename": "series-detail-rename", "merge": "series-detail-merge", "delete": "series-detail-delete"
  },
  "bookSeries": { "link": "book-series-link", "previous": "book-series-previous", "next": "book-series-next" }
}
```

## Auto test suite journeys

Each journey is added by the card that builds its screen. Suite `core` journeys run in `smoke` (CI and the regression gate); the rest use suite `p04` (`npm run -s autotest -- journey --suite p04`).

| Journey | Suite | Steps |
|---|---|---|
| `series-list` | `core` | fixture `demo`; `/series` → 2 rows with progress text |
| `series-detail-gaps` | `p04` | open Discworld → spines in order, one `seriesDetail.gap` "#2 missing" |
| `series-assign-in-form` | `p04` | edit a book → pick series "Discworld", position 2 → save → series detail has no gap |
| `series-merge` | `p04` | create duplicate series "Disc World" on a book → merge into Discworld → one series |
| `series-confirm-suggestion` | `p04` | mocked lookup with low-confidence hint → save → `seriesConfirm.root` → Yes → linked |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/series-browse.yaml` | fixture `demo` via deep link; open series from book detail; scroll the spine shelf; TalkBack-readable labels present |

## Risks

| Risk | Mitigation |
|---|---|
| Wrong series from imprint names | deny-list in `seriesParser`, confirmation UI, easy "Not a series" |
| Unknown total counts | infer from max position; user can set total; gaps only up to known max |
| Omnibus editions covering several positions | out of scope for v1; note field; revisit with ADR if users need ranges |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + lint + typecheck + Jest
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- Series can be assigned, detected, confirmed, browsed, merged and completed on Android and web.
- All P04 journeys pass with `--ux-gates fail`; Maestro flow passes.
- Regression gate green in CI.
