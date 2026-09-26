# Phase 02 — Metadata providers

## Goal

Given an ISBN or a title/author query, fetch book metadata from Open Library and Google Books politely, merge it into ranked candidates with genres and series hints, cache it, and cope gracefully with being offline. Expose it in the UI as "Look up by ISBN" and "Search online" on the add-book screen (usable on web, so it is fully testable before the camera arrives in Phase 03).

## Scope

- HTTP wrapper with User-Agent, rate limiting, backoff, timeouts, cancellation.
- Provider interface; Open Library (ISBN, works, authors, editions, search, covers); Google Books (ISBN, search).
- Candidate merge and ranking; genre normalisation; series extraction; summary trimming.
- Response cache and cover download; pending-lookup queue for offline.
- UI: lookup by ISBN, online search results, "Refresh details" on existing books.
- Recorded fixtures and auto test suite API mocking.

## Out of scope

- Camera, OCR, edition picker (Phase 03 — it reuses the candidate types built here).
- Series management UI (Phase 04).

## Prerequisites

- Phase 01 (book form, repositories, fixtures).
- Read `PLAN.md` §6 for endpoints, mappings and etiquette.

---

## Task cards

### P02-01 HTTP client wrapper

- **Description:** `httpGetJson(url, { signal, cacheTtl })` and `httpGetBinary` around `fetch`: 10 s timeout, `AbortSignal` support, `User-Agent: MyShelf/<version> (+https://github.com/asorichetti/MyShelf)` on native only (version from `expo-constants`), per-host queue at ≤ 1 request/second and ≤ 2 concurrent overall, retry on 429/5xx with exponential backoff (1 s, 2 s, 4 s; honour `Retry-After`), typed errors (`OfflineError`, `NotFoundError`, `RateLimitedError`, `HttpError`). `fetch` and clock injectable for tests.
- **Files:** `src/services/http/client.ts`, `src/services/http/rateLimiter.ts`, `src/services/http/errors.ts`, `src/services/http/userAgent.{native,web}.ts`.
- **Acceptance:** limiter spaces calls ≥ 1000 ms per host (fake timers); 3 retries then `RateLimitedError`; abort cancels queued and in-flight requests.
- **Tests:** `src/services/http/__tests__/client.test.ts`, `rateLimiter.test.ts`.

### P02-02 Provider interface and candidate model

- **Description:** `MetadataProvider { id; lookupIsbn(isbn13, signal): Promise<BookCandidate[]>; search(q: { title?, author?, text? }, signal): Promise<BookCandidate[]> }`. `BookCandidate` = normalised edition: title, subtitle, authors[], publisher, publicationYear, pageCount, isbn13, isbn10, language, format, summary, coverUrl, subjects[] (raw), seriesHints[] (`{ name, position?, source }`), workKey, source, sourceId, confidence.
- **Files:** `src/services/metadata/types.ts`.
- **Acceptance:** types compile; documented with TSDoc.
- **Tests:** type-level only (covered by provider tests).

### P02-03 Open Library: ISBN lookup

- **Description:** `openLibrary.lookupIsbn`: `GET /isbn/{isbn}.json` (follows redirect) → edition; then `GET /works/{id}.json` for `description` and `subjects`; then `GET /authors/{id}.json` for each author key (cached). Map fields per `PLAN.md` §6 (year from free-text `publish_date`, description string or `{value}`, language key → ISO 639-1, `physical_format` → format enum, `series[]` → series hints, cover from `covers[0]` → `https://covers.openlibrary.org/b/id/{id}-L.jpg`). `404` → `[]`.
- **Files:** `src/services/metadata/openLibrary.ts`, `src/services/metadata/openLibraryMap.ts`, `src/services/metadata/__fixtures__/openlibrary/*.json`.
- **Acceptance:** fixtures for a modern hardback, an old paperback with ISBN-10 only, an edition with `series`, an edition with no work description, and a 404 all map correctly.
- **Tests:** `src/services/metadata/__tests__/openLibrary.isbn.test.ts`, `openLibraryMap.test.ts`.

### P02-04 Open Library: search and work editions

- **Description:** `openLibrary.search`: `GET /search.json?title=&author=` (or `q=` for free text) with `fields=key,title,author_name,first_publish_year,edition_count,isbn,cover_i,subject,language&limit=10`; returns work-level candidates. `openLibrary.editions(workKey)`: `GET /works/{id}/editions.json?limit=50` → edition candidates (used by the edition picker in P03-08).
- **Files:** `src/services/metadata/openLibrary.ts`, fixtures.
- **Acceptance:** search for "the colour of magic" + "pratchett" returns the work first; editions list maps ISBNs, publishers, years, formats.
- **Tests:** `src/services/metadata/__tests__/openLibrary.search.test.ts`, `openLibrary.editions.test.ts`.

### P02-05 Google Books provider

- **Description:** `googleBooks.lookupIsbn` (`/volumes?q=isbn:{isbn}`) and `googleBooks.search` (`intitle:`/`inauthor:`), always with the `fields=` filter from `PLAN.md` §6, `printType=books`. Map `publishedDate` → year, `industryIdentifiers` → ISBNs, `categories` → subjects, strip HTML from `description`, rewrite thumbnail to `https` and drop `&edge=curl`, `seriesInfo.bookDisplayNumber` → series position hint. No API key.
- **Files:** `src/services/metadata/googleBooks.ts`, `src/services/metadata/googleBooksMap.ts`, fixtures under `__fixtures__/googlebooks/`.
- **Acceptance:** fixtures (with/without description, with categories, with `seriesInfo`, empty result) map correctly; `totalItems: 0` → `[]`.
- **Tests:** `src/services/metadata/__tests__/googleBooks.test.ts`.

### P02-06 Merge and rank candidates

- **Description:** `metadataService.lookupIsbn(isbn)` queries Open Library then Google Books (Google Books skipped if disabled in settings) and merges into one candidate per ISBN with field precedence (Open Library for edition facts; Google Books for summary/categories when Open Library lacks them; union of subjects and series hints). `metadataService.search(q)` merges both providers' results, de-duplicates by ISBN-13 then by normalised `title + first author`, and ranks by: exact title match, author match, has ISBN, has cover, edition count. Partial failure of one provider still returns the other's results with a `warnings` list.
- **Files:** `src/services/metadata/index.ts`, `src/services/metadata/merge.ts`, `src/services/metadata/rank.ts`, `src/domain/text.ts` (normalise: case, diacritics, punctuation, leading articles).
- **Acceptance:** merge precedence verified field by field; one provider throwing → results + warning; ranking stable.
- **Tests:** `src/services/metadata/__tests__/merge.test.ts`, `rank.test.ts`, `src/domain/__tests__/text.test.ts`.

### P02-07 Genre normaliser

- **Description:** Map raw subjects/categories to the curated genres from P01-09: splits BISAC-style paths ("Fiction / Fantasy / Epic" → Fiction, Fantasy), keyword table ("detective and mystery stories" → Mystery, "science fiction" → Science Fiction, "juvenile fiction" → Children's), drops noise (e.g. "Accessible book", "Protected DAISY", "In library", "nyt:*", long LC headings). Returns at most 3 genres, ordered by confidence. Unknown subjects are ignored, not added as genres.
- **Files:** `src/domain/genreNormaliser.ts`, `src/domain/genres.ts`.
- **Acceptance:** table-driven cases (≥ 40) from real fixture subjects pass.
- **Tests:** `src/domain/__tests__/genreNormaliser.test.ts`.

### P02-08 Series extraction

- **Description:** `extractSeries(candidate)` combines hints: Open Library `series[]` strings (`"Discworld ; 5"`, `"Harry Potter -- 1"`, `"Discworld novel, 5"`, `"The Expanse #3"`), title patterns (`"Title (Series Name, #3)"`, `"Series Name Book 3: Title"`, `"Title: A Series Name Novel"` without position), and Google Books `bookDisplayNumber`. Returns `{ name, position | null, confidence }` or null. Strips publisher imprint series (e.g. "Penguin Classics", "Everyman's Library", "Oxford World's Classics") via a deny-list.
- **Files:** `src/domain/seriesParser.ts`.
- **Acceptance:** ≥ 30 table cases including decimals ("2.5"), roman numerals ("Book IV" → 4), and imprint deny-list.
- **Tests:** `src/domain/__tests__/seriesParser.test.ts`.

### P02-09 Response cache and cover download

- **Description:** Migration `0002_api_cache` adds `api_cache(url TEXT PRIMARY KEY, body TEXT, fetched_at TEXT)`; the HTTP wrapper reads/writes it for JSON with a 30-day TTL; `cache.prune()` on start-up deletes expired rows and caps the table at 5 MB. Covers: on save, download the chosen cover with `expo-file-system` (install with `npx expo install expo-file-system`) to `<documentDirectory>/covers/<bookId>.jpg` and store that `file://` URI in `cover_uri`; on web keep the remote URL. Covers are fetched only on user action (save or explicit refresh).
- **Files:** `src/db/migrations/0002_api_cache.ts`, `src/db/repositories/apiCache.ts`, `src/services/http/cache.ts`, `src/services/covers/{downloadCover.native,downloadCover.web}.ts`.
- **Acceptance:** second identical lookup makes zero network calls; expired entry refetched; deleting a book deletes its cover file.
- **Tests:** `src/db/repositories/__tests__/apiCache.test.ts`, `src/services/http/__tests__/cache.test.ts`, `src/services/covers/__tests__/downloadCover.test.ts` (mocked file system).

### P02-10 Offline handling and pending lookups

- **Description:** Migration `0003_pending_lookups` adds `pending_lookups(isbn13 TEXT PRIMARY KEY, requested_at TEXT, attempts INTEGER, last_error TEXT)`. When a lookup fails with `OfflineError`, the caller can queue the ISBN. `usePendingLookups()` retries the queue when the app returns to the foreground (`AppState`), one at a time, and notifies the user (Booky *sleepy* → *excited*) when results arrive; the user then confirms each via the candidate UI. Queue visible in Settings (P08-01) and as a banner on the Shelf ("2 books waiting for details").
- **Files:** `src/db/migrations/0003_pending_lookups.ts`, `src/db/repositories/pendingLookups.ts`, `src/features/lookup/usePendingLookups.ts`, `src/components/book/PendingBanner.tsx`.
- **Acceptance:** offline lookup queues once (no duplicates); retry succeeds when online; attempts capped at 5 with a friendly failure.
- **Tests:** `src/db/repositories/__tests__/pendingLookups.test.ts`, `src/features/lookup/__tests__/usePendingLookups.test.tsx`.

### P02-11 "Look up by ISBN" and "Search online" in the add flow

- **Description:** On `book/new`, a top section: ISBN field + "Look up" button and a "Search online" field (title/author). Results show as `CandidateCard`s (cover, title, authors, year, publisher, format, source badge). Choosing one prefills `BookForm` (authors, genres from normaliser, series hint, summary trimmed with `briefSummary()`) for review before saving; `source`/`source_id` recorded. Loading state uses Booky *thinking*; no results → Booky *concerned* + "Add it by hand". The candidate → draft mapping is `candidateToDraft()`.
- **Files:** `src/app/book/new.tsx`, `src/components/book/CandidateCard.tsx`, `src/components/book/CandidateList.tsx`, `src/features/lookup/useLookup.ts`, `src/domain/candidateToDraft.ts`, `src/domain/summary.ts`.
- **Acceptance:** lookup of a fixture ISBN pre-fills every mapped field; cancelling mid-lookup aborts the request; user edits before save are kept.
- **Tests:** `src/features/lookup/__tests__/useLookup.test.tsx`, `src/domain/__tests__/candidateToDraft.test.ts`, `src/domain/__tests__/summary.test.ts`, `src/__tests__/bookNew.lookup.test.tsx`.

### P02-12 Refresh details for an existing book

- **Description:** Book detail overflow → "Refresh details". Looks up by ISBN (or search by title/author when no ISBN) and shows a field-by-field diff ("Summary: add", "Pages: 320 → 336"); the user ticks what to apply. Genres with `user_edited = 1` are never removed.
- **Files:** `src/app/book/[id]/refresh.tsx`, `src/domain/draftDiff.ts`, `src/features/lookup/useRefresh.ts`.
- **Acceptance:** only ticked fields change; user-edited genres preserved.
- **Tests:** `src/domain/__tests__/draftDiff.test.ts`, `src/__tests__/bookRefresh.test.tsx`.

### P02-13 Auto test suite API mocking and recorded fixtures

- **Description:** Add API mocking to the existing auto test suite (`tools/auto-test-suite`). A new global flag `--mock-api <dir>` (declared with the other global flags in `tools/auto-test-suite/src/cli.ts` and passed to every command and journey run) points at a fixture directory with a URL → file index (`index.json`: URL pattern, status, content type, body file, optional `expected: true` for deliberate error responses). Journeys use `src/services/metadata/__fixtures__` by default, so `smoke` needs no extra flag; `--mock-api off` disables it. It plugs in where the browser context is created in `tools/auto-test-suite/src/browser/`: a `context.route()` handler (new `tools/auto-test-suite/src/mockapi/` module) is registered before the page is opened, so it covers the first request of every command and journey. Requests to `openlibrary.org`, `covers.openlibrary.org` and `www.googleapis.com` are fulfilled from the index; any other request that leaves the base URL's origin, and any unindexed URL on those hosts, is aborted and reported by the `network` gate under a new rule `unmocked` with the URL, so real external calls fail journeys. Fixture responses marked `expected` (404 for an unknown ISBN, 500 for the partial-failure journey) are exempt from the `network` and `console` gates in the same way as URLs carrying the `__expected-404` marker today; every other status ≥ 400 still fails. Add `scripts/record-fixture.mjs <url>` to record a new fixture (run manually, respects the API etiquette, strips nothing personal because nothing personal is sent). Document the flag in the tool README.
- **Files:** `tools/auto-test-suite/src/mockapi/` (new), `tools/auto-test-suite/src/browser/`, `tools/auto-test-suite/src/cli.ts`, the network and console gates in `tools/auto-test-suite/src/uxgates/`, `tools/auto-test-suite/README.md`; `src/services/metadata/__fixtures__/index.json`; `scripts/record-fixture.mjs`.
- **Acceptance:** P02 journeys pass with no external network (verified by running them offline); an unindexed URL fails the run with a `network`/`unmocked` finding that names it; a deliberate fixture 404 does not.
- **Tests:** unit tests for the index loader and URL matcher (run by `npm run autotest:check`); the journeys below.

---

## Test ids to add to `selectors.json`

```json
{
  "lookup": {
    "isbnInput": "lookup-isbn-input", "isbnSubmit": "lookup-isbn-submit",
    "searchInput": "lookup-search-input", "searchSubmit": "lookup-search-submit",
    "loading": "lookup-loading", "results": "lookup-results", "candidate": "lookup-candidate",
    "noResults": "lookup-no-results", "addManually": "lookup-add-manually", "cancel": "lookup-cancel"
  },
  "pending": { "banner": "pending-banner", "retry": "pending-retry" },
  "refresh": {
    "root": "refresh-root", "open": "refresh-open", "fieldRow": "refresh-field-row",
    "fieldToggle": "refresh-field-toggle", "apply": "refresh-apply"
  }
}
```

## Auto test suite journeys

Each journey is added by the card that builds its screen. Suite `core` journeys run in `smoke` (CI and the regression gate); the rest use suite `p02` (`npm run -s autotest -- journey --suite p02`).

| Journey | Suite | Steps |
|---|---|---|
| `lookup-isbn-found` | `core` | fixture `empty`, mock API; `/book/new`; ISBN `9780552166591` → candidate → choose → form prefilled (title, author, year, genre, series) → save → detail |
| `lookup-isbn-not-found` | `p02` | ISBN with 404 fixtures (marked `expected`) → `lookup.noResults` → `lookup.addManually` focuses title |
| `lookup-search-title` | `p02` | search "colour of magic pratchett" → ≥ 1 candidate, first matches |
| `lookup-provider-partial-failure` | `p02` | Google Books fixture returns 500 (marked `expected`) → Open Library result still shown, no `page-error` |
| `book-refresh-diff` | `p02` | fixture `demo`; open book with missing summary → refresh → apply summary only → detail shows summary |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/lookup-isbn-online.yaml` | on device with network: type a known ISBN, get details, save (tagged `network`; skipped offline) |
| `.maestro/lookup-offline-queue.yaml` | airplane mode on → lookup queues with banner → airplane mode off → app foreground → details arrive |

## Risks

| Risk | Mitigation |
|---|---|
| API response shapes change | mapping isolated in `*Map.ts`; fixture tests; tolerant parsing (all fields optional) |
| Keyless quotas / 429 | rate limiter, cache, backoff; Google Books can be turned off in settings |
| Series data is sparse or wrong | treat as hints with confidence; user confirms in form (Phase 04 UI) |
| Summaries contain HTML or are very long | strip + `briefSummary()` with tests |
| Web CORS | both APIs allow browser CORS for GET; covers loaded as images; fixtures in tests anyway |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + lint + typecheck + Jest
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

`autotest:smoke` needs the web server running (`CI=1 npx expo start --web --port 8081`). Phase close also requires every journey, including this phase's, to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- ISBN lookup and online search prefill the add form on Android and web.
- Offline scans/lookups queue and complete later.
- All P02 journeys pass with mocked APIs and `--ux-gates fail`; Maestro flows run on a device.
- Regression gate green in CI.
