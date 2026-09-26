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

### P04-02 Series picker in the book form — done

- **Description:** Replace P01's free-text series fields with `SeriesInput`: search existing series, create new inline, position number field (accepts `3`, `3.5`, `III`), "Not part of a series" clear action. Shows "Suggested: Discworld #5" chip when the draft came from a candidate with a series hint; tapping accepts it.
- **Files:** `src/components/book/SeriesInput.tsx`, `src/components/book/BookForm.tsx`, `src/domain/seriesPosition.ts` (parse/format; roman numerals).
- **Acceptance:** positions round-trip (`2.5` shown as "2.5", `5` as "5"); suggestion chip only when a hint exists.
- **Tests:** `src/components/book/__tests__/SeriesInput.test.tsx`, `src/domain/__tests__/seriesPosition.test.ts`.
- **Delivered (domain):** `src/domain/seriesPosition.ts`: `parseSeriesPosition` accepts `3`, `#3`, `3.5`, `3,5`, `2½`, `III`, `Book 3`, `vol. 2`, `Part Two` and `Book 3 of 9`, reusing `parsePosition` and the `POSITION_KEYWORD` list from `seriesParser.ts` (now exported) so the form and the metadata parser agree; `formatSeriesPosition` (`5` → "5", `2.5` → "2.5", float noise rounded to three places; round-trips), `formatSeriesLabel` ("Discworld #5" for the suggestion chip) and `isValidSeriesPosition`.
- **Delivered (UI):** `SeriesInput` (`src/components/book/SeriesInput.tsx`) replaces the two free-text fields: typing searches the library's series (`matchingSeries`: case-, accent- and article-insensitive like `findSeriesByName`, up to five, starts-with first) with each option showing its book count, "New series “…”" creates one inline, a status line says "In your library · 3 books" or that a new series is added on save, the Number field reads `3`, `2.5`, `III`, `Book 3 of 9` and previews "Saves as #3", and "Not part of a series" clears both. The draft keeps its `seriesName` / `seriesPosition` text fields, so validation and saving are unchanged. `BookForm` takes two optional props: `existingSeries` (the screen passes `useSeriesOptions()`) and `seriesSuggestion` (`{ name, position }`), which shows the "Suggested: Discworld #5" chip; nothing passes a suggestion yet — the lookup/scan path should pass the candidate's `extractSeries` result. `/book/new?series=Discworld&position=3` starts a new book in a series (P04-05's "Add #3"). The `bookForm.seriesName` / `bookForm.seriesPosition` test ids were replaced by `seriesInput.search` / `seriesInput.position`. Tests: `SeriesInput.test.tsx`, `src/__tests__/seriesForm.test.tsx`.

### P04-03 Confirm detected series on save — done

- **Description:** When saving from a candidate (P03-09, P02-11) with a series hint of confidence < high, show an inline confirmation on the detail page: "Is this Discworld #5?" with Yes / Change / Not a series. High-confidence hints (Open Library `series` with a position) are applied directly but still editable.
- **Files:** `src/components/book/SeriesConfirm.tsx`, `src/features/book/useSeriesConfirm.ts`.
- **Acceptance:** "Yes" keeps the link and hides the prompt; "Change" opens `SeriesInput`; "Not a series" clears `series_id` and records the book id in the settings key `series.dismissedBookIds` so the prompt never reappears for that book (and a later "Refresh details" does not re-add the series).
- **Tests:** `src/features/book/__tests__/useSeriesConfirm.test.tsx`.
- **Delivered:** `applyDetectedSeries(db, bookId, match)` (`src/features/series/detectedSeries.ts`) links a saved book to the guessed series; a `high` guess is applied directly, a `medium` or `low` one is applied and queued in the setting `series.pendingConfirmBookIds`; a book in `series.dismissedBookIds` is left alone (returns `'dismissed'`), so "Refresh details" never re-adds it. The book page's Series section shows `SeriesConfirm` while the book is queued: Yes unqueues it, Change opens `SeriesInput` in place with Save series / Cancel, Not a series unlinks the book and records the dismissal. **Not wired yet:** no save path calls `applyDetectedSeries` on `main`; the scan/lookup save (`useSaveCandidate`, P03-09) should call it after saving the book with `extractSeries(candidate)`. Until then the `series` E2E fixture (two guessed series, loaded through `FixtureBook.series.detected`) stands in for a lookup, and the journey is `series-confirm-detected` rather than a mocked lookup.

### P04-04 Series list screen — done

- **Description:** Route `src/app/series/index.tsx`, reachable from Shelf group-by (P06-01) and from book detail. Each row: series name, a mini row of spines (owned = filled, missing = dashed), "5 of 9" progress. Sort by name or most recent addition. Empty state with Booky.
- **Files:** `src/app/series/index.tsx`, `src/components/series/SeriesRow.tsx`, `src/components/series/MiniSpines.tsx`, `src/features/series/useSeriesList.ts`.
- **Acceptance:** counts match `demo`; accessible label "Discworld, 5 of 9 owned, 2 missing".
- **Tests:** `src/__tests__/seriesList.test.tsx`, `src/components/series/__tests__/SeriesRow.test.tsx`.
- **Delivered:** the route is a one-line re-export of `SeriesListScreen` (`src/features/series`). Rows are links labelled with `seriesLabel` ("Discworld, 3 of 4 owned, 1 missing"; "…, complete" once a user-set total is reached; "…, none missing so far" without a total), sorted by the "A to Z" / "Recently added" radios. `SeriesSummary` gained `gaps` for the mini spines. It is reachable from book detail (the series link, then "All series" on the series page); the Groups/browse hub (P06-11) should link to `/series`.

### P04-05 Series detail screen — done

- **Description:** Route `src/app/series/[id].tsx`: header with name, progress bar, total-count editor ("How many books are in this series?"); ordered list of books as spines on a brass shelf, with dashed placeholder spines for gaps labelled "#2 missing" (tap → "Add #2" opens scan or manual add with series prefilled). Actions: rename, merge into another series, delete series.
- **Files:** `src/app/series/[id].tsx`, `src/components/series/SeriesShelf.tsx`, `src/components/book/Spine.tsx`, `src/features/series/useSeries.ts`.
- **Acceptance:** gaps rendered in order; merge flow with picker and confirmation; rename updates everywhere.
- **Tests:** `src/__tests__/seriesDetail.test.tsx`, `src/components/book/__tests__/Spine.test.tsx`.
- **Delivered:** `SeriesDetailScreen` shows the name (h1), "3 of 4 owned, 1 missing" with a progress bar, the shelf (`SeriesShelf`: `Spine`s on a brass edge, dashed gaps, scrolling sideways; decorative, since the list below says the same), then "In reading order" (`SeriesBookList`): each book with its real cover (or the generated one) and number, and each gap as a dashed "#3 missing" card with "Add #3", which opens the manual add form with the series filled in (scan does not take a series yet). "How many books are in this series?" saves the total (a whole number, not below the highest number owned; empty forgets it). Rename, merge (a radio list of the other series, then a confirmation naming what moves) and delete are in the ⋮ menu. `seriesSlots` interleaves books and gaps; unnumbered books come last.

### P04-06 Series on book detail — done

- **Description:** Book detail series section links to the series screen and shows "Book 5 of 9", "Previous: …" and "Next: …" (next owned or "#6 not on your shelf yet").
- **Files:** `src/components/book/SeriesSection.tsx`, `src/app/book/[id].tsx`, `src/db/repositories/series.ts` (`neighbours(bookId)`).
- **Acceptance:** first/last book edge cases; fractional positions ordered correctly.
- **Tests:** `src/db/repositories/__tests__/series.neighbours.test.ts`, `src/components/book/__tests__/SeriesSection.test.tsx`.
- **Delivered:** the book page renders `BookSeries` (`src/features/series/BookSeries.tsx`), which loads `seriesRepo.neighbours(db, bookId)` (series, position, progress, book count, previous/next) and shows `SeriesSection`: a link to the series with "Book 5 of 9" ("Book 5" without a user-set total), a mini shelf and the progress, then "Previous: Mort (#4)" / "Next: #6 isn’t on your shelf yet". The pure rule is `neighboursInSeries` (`src/domain/seriesNeighbours.ts`): the neighbour is the next owned book if it comes no later than the next whole number, else that missing number (up to the known length).

### P04-07 Series gap tip — done

- **Description:** Publish a `series-gap` event when a save creates or reveals a gap; Booky (*thinking*) says "You have #1 and #3 of Discworld — #2 is missing." once per series (tip id `series-gap:<seriesId>`). The rules engine consumes it in P07-02; until then call `useBooky().showTip` directly.
- **Files:** `src/features/series/seriesEvents.ts`, `src/features/scan/useSaveCandidate.ts`.
- **Acceptance:** tip appears once per series; not shown in Quiet mode (after P07-06).
- **Tests:** `src/features/series/__tests__/seriesEvents.test.ts`.
- **Delivered:** `seriesEvents.ts` has `beginSeriesSave(db, { bookId, seriesNames, seriesIds })`, which snapshots the series a save may touch, and `probe.finish(savedBookId)`, which compares before and after (`seriesMilestones` in `src/domain/seriesMilestones.ts`) and publishes a `series-gap` milestone when the save created a gap or added a book to a series that has one. It shows once per series (`series.gapTipSeriesIds`), not when the tip id `series-gap:<id>` is in `mutedTips`, and not in Quiet or Off mode. `useBookForm` wraps its save this way; **the scan save path (`useSaveCandidate`) should do the same** (see the comment at the top of `seriesEvents.ts`). The tip is shown by `SeriesEventHost` in the root layout rather than through `useBooky().showTip`, because saves land on the book page, outside the tabs where `BookyTipHost` lives; it has a "See the series" action. P07-02 can subscribe with `subscribeSeriesMilestones`.

### P04-08 Series completion celebration — done

- **Description:** When a save makes owned = `total_count` with no gaps, Booky (*excited*) "Series complete! All 9 Discworld books." and a one-time confetti of tiny bookmarks (skipped with reduce-motion).
- **Files:** `src/features/series/seriesEvents.ts`, `src/components/booky/Celebration.tsx`.
- **Acceptance:** fires once per series completion; not re-fired on edits that keep it complete.
- **Tests:** `src/features/series/__tests__/completion.test.ts`, `src/components/booky/__tests__/Celebration.test.tsx`.
- **Delivered:** the same probe publishes `series-complete` when a series goes from not complete to complete (a book save, "Change" on the confirmation, setting the total or a merge), so edits that keep it complete do not celebrate again. `Celebration` shows excited Booky ("Hooray!" and the message, announced politely) and, after 150 ms (once the reduce-motion preference is known), 28 falling bookmarks for about 2.6 s, hidden from assistive tech and never catching a tap; with reduce motion there is no shower. It is skipped when Booky is Off.

---

## Test ids in `selectors.json`

As built: `seriesInput` (`search`, `option`, `create`, `status`, `position`, `clear`, `suggestion`), `seriesConfirm` (`root`, `yes`, `change`, `no`, `save`, `cancel`), `seriesList` (`root`, `title`, `row`, `sortName`, `sortRecent`, `empty`), `seriesDetail` (`root`, `title`, `back`, `allSeries`, `progress`, `shelf`, `spine`, `gap`, `book`, `addGap`, `totalCount`, `totalSave`, `more`, `rename`, `renameInput`, `merge`, `mergeOption`, `delete`), `bookSeries` (`link`, `place`, `previous`, `next`), `seriesTip` (`root`, `text`, `open`, `dismiss`) and `seriesCelebration` (`root`, `text`, `confetti`, `dismiss`). The book page's section keeps `bookDetail.series`.

## Auto test suite journeys

All in suite `p04` (`npm run -s autotest -- journey --suite p04`), in `tools/auto-test-suite/src/journeys/series.journey.ts`.

| Journey | Steps |
|---|---|
| `series-list` | fixture `demo`; `/series` → rows "Discworld, 3 of 4 owned, 1 missing" and "Earthsea, 2 of 3 owned, 1 missing"; "Recently added" radio; open Earthsea |
| `series-detail-gaps` | open Discworld → shelf `#1, #2, gap #3 missing, #4`, books in order; Add #3 → `/book/new` with Discworld #3 filled in |
| `series-assign-in-form` | edit Good Omens → search "disc" → pick Discworld → number "III" ("Saves as #3") → save → Book 3 between #2 and #4 → the series has no gap |
| `series-book-section` | The Light Fantastic: Book 2, Previous: The Colour of Magic (#1), Next: #3 isn’t on your shelf yet; previous and the series link navigate |
| `series-confirm-detected` | fixture `series`: Guards! Guards! → "Is this Discworld #8?" → Yes, still gone after reload; The Name of the Wind → Not a series, still gone after reload |
| `series-gap-tip` | add Discworld #6 → Booky's gap tip → See the series; adding #8 does not repeat it |
| `series-complete-celebration` | Earthsea total 3 → Add #2 → save → "Series complete! All 3 Earthsea books." with falling bookmarks → dismiss |
| `series-complete-reduced-motion` | the same with `prefers-reduced-motion: reduce`: the bubble, no confetti |
| `series-merge` | Good Omens into a new "Disc World" #5 → merge into Discworld after confirming → two series |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/series-browse.yaml` | fixture `demo` via deep link; open series from book detail; scroll the spine shelf; TalkBack-readable labels present. **Not written yet:** `.maestro/` does not exist until P00-18. |

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
