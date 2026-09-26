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

### P02-01 HTTP client wrapper — done

- **Description:** `httpGetJson(url, { signal, cacheTtl })` and `httpGetBinary` around `fetch`: 10 s timeout, `AbortSignal` support, `User-Agent: MyShelf/<version> (+https://github.com/asorichetti/MyShelf)` on native only (version from `expo-constants`), per-host queue at ≤ 1 request/second and ≤ 2 concurrent overall, retry on 429/5xx with exponential backoff (1 s, 2 s, 4 s; honour `Retry-After`), typed errors (`OfflineError`, `NotFoundError`, `RateLimitedError`, `HttpError`). `fetch` and clock injectable for tests.
- **Files:** `src/services/http/client.ts`, `src/services/http/rateLimiter.ts`, `src/services/http/errors.ts`, `src/services/http/userAgent.ts` (native) and `userAgent.web.ts`, `src/services/http/clock.ts`.
- **Acceptance:** limiter spaces calls ≥ 1000 ms per host (fake timers); 3 retries then `RateLimitedError`; abort cancels queued and in-flight requests.
- **Tests:** `src/services/http/__tests__/client.test.ts`, `rateLimiter.test.ts`.
- **Delivered:** the client is `createHttpClient({ fetch, userAgent, clock, limiter, timeoutMs, retryDelaysMs })` returning `getJson(url, { signal, giveUp })` and `getBinary(url, …)` (bytes + content type); `cacheTtl` arrived with the cache in P02-09. Following the platform-file convention in the code (`cssVars.ts` / `cssVars.web.ts`), the user agent is `userAgent.ts` (native, reads the version from `expo-constants`) and `userAgent.web.ts` (none), with the shared formatter in `userAgent.shared.ts`; the time source is `clock.ts`. `TimeoutError` extends `OfflineError` (a request that cannot finish is treated as offline for queueing). A `Retry-After` above 30 s fails at once instead of waiting, and a request can pass `giveUp(status, body)` to skip retries for limits that backing off cannot fix (Google Books' daily quota, see P02-05). `index.ts` re-exports the module.

### P02-02 Provider interface and candidate model — done

- **Description:** `MetadataProvider { id; lookupIsbn(isbn13, signal): Promise<BookCandidate[]>; search(q: { title?, author?, text? }, signal): Promise<BookCandidate[]> }`. `BookCandidate` = normalised edition: title, subtitle, authors[], publisher, publicationYear, pageCount, isbn13, isbn10, language, format, summary, coverUrl, subjects[] (raw), seriesHints[] (`{ name, position?, source }`), workKey, source, sourceId, confidence.
- **Files:** `src/services/metadata/types.ts`.
- **Acceptance:** types compile; documented with TSDoc.
- **Tests:** type-level only (covered by provider tests).
- **Delivered:** besides the listed fields, `BookCandidate` has `kind` (`edition` or `work`: Open Library search returns works), `edition` (edition statement, for `books.edition`) and `editionCount` (used in ranking). A `SeriesHint` name may be null because Google Books gives only a position. `ProviderWarning` and `MetadataResult` (candidates + warnings) are the service's return types; `candidate.ts` has `makeCandidate()` for mappers and tests.

### P02-03 Open Library: ISBN lookup — done

- **Description:** `openLibrary.lookupIsbn`: `GET /isbn/{isbn}.json` (follows redirect) → edition; then `GET /works/{id}.json` for `description` and `subjects`; then `GET /authors/{id}.json` for each author key (cached). Map fields per `PLAN.md` §6 (year from free-text `publish_date`, description string or `{value}`, language key → ISO 639-1, `physical_format` → format enum, `series[]` → series hints, cover from `covers[0]` → `https://covers.openlibrary.org/b/id/{id}-L.jpg`). `404` → `[]`.
- **Files:** `src/services/metadata/openLibrary.ts`, `src/services/metadata/openLibraryMap.ts`, `src/services/metadata/__fixtures__/openlibrary/*.json`.
- **Acceptance:** fixtures for a modern hardback, an old paperback with ISBN-10 only, an edition with `series`, an edition with no work description, and a 404 all map correctly.
- **Tests:** `src/services/metadata/__tests__/openLibrary.isbn.test.ts`, `openLibraryMap.test.ts`.
- **Delivered:** `createOpenLibrary({ http })` returns the provider. Fixtures are real responses recorded in September 2026 (`__fixtures__/openlibrary/*.json`, trimmed of bulky fields), wired to their URLs in `__fixtures__/openLibraryRoutes.ts` and served by `createFixtureFetch()` (`src/testing/fixtureFetch.ts`), which answers 501 to any unrecorded URL. They cover a modern hardback (Harry Potter, Bloomsbury), an old paperback with only an ISBN-10 (Fellowship, Ballantine), editions with `series` (Colour of Magic, Moving Pictures, Dune), a record with no work description, authors or subjects, non-English editions (French, Spanish) and a 404. What the real API taught us: many modern editions have no `authors`, so names come from the work's `authors[].author.key`; the 404 body is HTML, not JSON; some records store decomposed accents (`n` + U+0303), so text is NFC-normalised; `covers[]` can contain `-1`; `pagination` ("xlii, 435 p.") stands in for a missing `number_of_pages`; descriptions carry Markdown and "back cover" markers, which are removed. The work description wins; the edition's `description` is the fallback. Language keys map through `src/domain/languages.ts` (`toIso6391`). A 404 on the work or an author still returns the edition.

### P02-04 Open Library: search and work editions — done

- **Description:** `openLibrary.search`: `GET /search.json?title=&author=` (or `q=` for free text) with `fields=key,title,author_name,first_publish_year,edition_count,isbn,cover_i,subject,language&limit=10`; returns work-level candidates. `openLibrary.editions(workKey)`: `GET /works/{id}/editions.json?limit=50` → edition candidates (used by the edition picker in P03-08).
- **Files:** `src/services/metadata/openLibrary.ts`, fixtures.
- **Acceptance:** search for "the colour of magic" + "pratchett" returns the work first; editions list maps ISBNs, publishers, years, formats.
- **Tests:** `src/services/metadata/__tests__/openLibrary.search.test.ts`, `openLibrary.editions.test.ts`.
- **Delivered:** search results are work candidates (`kind: 'work'`, no ISBN, with `editionCount`); the title search sends `title=` and `author=`, free text sends `q=`. `editions(workKey, { signal, authors, limit })` takes the work's authors because edition entries rarely have resolvable ones. Fixtures: the real title/author search for "the colour of magic" + "pratchett", a free-text search for "dune frank herbert", and 13 of the 50 recorded editions of `OL453657W` chosen for variety (French, German, Portuguese, Polish, Czech, audio, ebook, mass-market, a computer game with no ISBN). Ranking across providers is P02-06; Open Library already returns the work first.

### P02-05 Google Books provider — done

- **Description:** `googleBooks.lookupIsbn` (`/volumes?q=isbn:{isbn}`) and `googleBooks.search` (`intitle:`/`inauthor:`), always with the `fields=` filter from `PLAN.md` §6, `printType=books`. Map `publishedDate` → year, `industryIdentifiers` → ISBNs, `categories` → subjects, strip HTML from `description`, rewrite thumbnail to `https` and drop `&edge=curl`, `seriesInfo.bookDisplayNumber` → series position hint. No API key.
- **Files:** `src/services/metadata/googleBooks.ts`, `src/services/metadata/googleBooksMap.ts`, fixtures under `__fixtures__/googlebooks/`.
- **Acceptance:** fixtures (with/without description, with categories, with `seriesInfo`, empty result) map correctly; `totalItems: 0` → `[]`.
- **Tests:** `src/services/metadata/__tests__/googleBooks.test.ts`.
- **Delivered:** **the fixtures are synthetic, except one.** Keyless Google Books refused every request while this card was built (September 2026, two networks): `429 RESOURCE_EXHAUSTED`, "Queries per day", quota limit `0` on the shared keyless project, no `Retry-After`. That real body is `__fixtures__/googlebooks/quota-exceeded-429.json`; the `synthetic-*.json` files are hand-written to the documented v1 Volume schema with facts from the matching Open Library records and invented volume ids (`synth…`), and `googleBooksRoutes.ts` says so. Re-record them when keyless access works. Because of this, a daily-quota 429 fails at once (`isDailyQuotaError` passed as the client's `giveUp`) instead of retrying for 7 s. Other details: the `fields=` filter also asks for `totalItems`; an ISBN lookup keeps only volumes carrying that ISBN (Google adds other editions); search sends `intitle:"…" inauthor:"…"` (quoted phrases) or the free text; a parenthesised subtitle such as `(Discworld Novel 1)` becomes a series hint, not a subtitle. `stripHtml` lives in `src/domain/text.ts` for reuse by `briefSummary()`. PLAN §6 now records the keyless quota behaviour.

### P02-06 Merge and rank candidates — done

- **Description:** `metadataService.lookupIsbn(isbn)` queries Open Library then Google Books (Google Books skipped if disabled in settings) and merges into one candidate per ISBN with field precedence (Open Library for edition facts; Google Books for summary/categories when Open Library lacks them; union of subjects and series hints). `metadataService.search(q)` merges both providers' results, de-duplicates by ISBN-13 then by normalised `title + first author`, and ranks by: exact title match, author match, has ISBN, has cover, edition count. Partial failure of one provider still returns the other's results with a `warnings` list.
- **Files:** `src/services/metadata/index.ts`, `src/services/metadata/merge.ts`, `src/services/metadata/rank.ts`, `src/domain/text.ts` (normalise: case, diacritics, punctuation, leading articles).
- **Acceptance:** merge precedence verified field by field; one provider throwing → results + warning; ranking stable.
- **Tests:** `src/services/metadata/__tests__/merge.test.ts`, `rank.test.ts`, `src/domain/__tests__/text.test.ts`.
- **Delivered:** `createMetadataService({ openLibrary, googleBooks, isGoogleBooksEnabled, googleBooksCooldownMs, clock })` (or `createDefaultMetadataService({ http })`) returns `lookupIsbn(isbn, { signal })`, `search(query, { signal })` and `editions(workKey)`, each resolving to `{ candidates, warnings }` (editions: a list). Both providers are asked in parallel (they are different hosts; the limiter allows two in flight) and merged with Open Library first. `lookupIsbn` accepts ISBN-10 or ISBN-13 and rejects bad input with `InvalidIsbnError`; when every provider fails it rejects with `OfflineError` if any was offline (so the caller can queue the ISBN), else the first error. After a Google Books `RateLimitedError` (its daily quota, see P02-05) Google Books rests for an hour (or its `Retry-After`) and each lookup meanwhile carries a `rate-limited` warning. Merging by title + first author happens only when one side has no ISBN, so two editions with different ISBNs stay apart. Ranking weights: exact title 8, title containing the query 4, author 4, ISBN 2, cover 1, edition count up to 2 (log10); `confidence` becomes the score over the maximum. `src/domain/text.ts` (with tests) landed with P02-08. The setting is `googleBooksEnabled` in `AppSettings` (default on); its Settings row is P08-05.

### P02-07 Genre normaliser — done

- **Description:** Map raw subjects/categories to the curated genres from P01-09: splits BISAC-style paths ("Fiction / Fantasy / Epic" → Fiction, Fantasy), keyword table ("detective and mystery stories" → Mystery, "science fiction" → Science Fiction, "juvenile fiction" → Children's), drops noise (e.g. "Accessible book", "Protected DAISY", "In library", "nyt:*", long LC headings). Returns at most 3 genres, ordered by confidence. Unknown subjects are ignored, not added as genres.
- **Files:** `src/domain/genreNormaliser.ts`, `src/domain/genres.ts`.
- **Acceptance:** table-driven cases (≥ 40) from real fixture subjects pass.
- **Tests:** `src/domain/__tests__/genreNormaliser.test.ts`.
- **Delivered:** `normaliseGenres(subjects, { max, minShare })` returns curated genre names; `scoreGenres` exposes the scores. Real subjects are noisy (The Martian is also tagged "Children's fiction" and "Fantasy fiction"; Pride and Prejudice "History"), so every subject votes: BISAC paths, including Open Library's comma form ("Fiction, fantasy, general"), count double; a subject naming several genres splits its vote; Fiction is a generic parent worth half and listed after the specific genres; a specific genre needs 30 % of the strongest one's score; non-fiction genres are halved when the subjects say the book is a novel; LC "Topic, fiction" and "Topic -- Juvenile fiction" read the form, not the topic. The curated list is `curatedGenres` in `src/domain/genres.ts` (P01-09's starter list, which P01-09 puts in `src/domain/genre.ts` as `starterGenres`; one should re-export the other when both land). 99 table cases: 87 single subjects (most copied from the recorded fixtures) and every recorded book.

### P02-08 Series extraction — done

- **Description:** `extractSeries(candidate)` combines hints: Open Library `series[]` strings (`"Discworld ; 5"`, `"Harry Potter -- 1"`, `"Discworld novel, 5"`, `"The Expanse #3"`), title patterns (`"Title (Series Name, #3)"`, `"Series Name Book 3: Title"`, `"Title: A Series Name Novel"` without position), and Google Books `bookDisplayNumber`. Returns `{ name, position | null, confidence }` or null. Strips publisher imprint series (e.g. "Penguin Classics", "Everyman's Library", "Oxford World's Classics") via a deny-list.
- **Files:** `src/domain/seriesParser.ts`.
- **Acceptance:** ≥ 30 table cases including decimals ("2.5"), roman numerals ("Book IV" → 4), and imprint deny-list.
- **Tests:** `src/domain/__tests__/seriesParser.test.ts`.
- **Delivered:** `extractSeries({ title, subtitle, seriesHints })` returns `{ name, position, confidence }` with confidence `high` (a provider series with a position), `medium` (a series without a position, a title pattern with one, or a position filled in from Google Books) or `low` (a title pattern without a position), matching what P04-03 expects. Also exported: `parseSeriesString`, `parseSeriesFromTitle`, `parsePosition` (decimals, roman numerals up to LX, number words), `isImprintSeries` and `cleanSeriesName`. The table covers every series string in the recorded Open Library fixtures (e.g. `"Discworld, Book 1"`, `"Harry Potter, #1"`, `"Dune chronicles -- bk. 1"`, `"Świat Dysku, Part I"`); 90 cases in all. It uses `src/domain/text.ts` from P02-06, which landed in the same commit.

### P02-09 Response cache and cover download — done

- **Description:** Migration `0002_api_cache` adds `api_cache(url TEXT PRIMARY KEY, body TEXT, fetched_at TEXT)`; the HTTP wrapper reads/writes it for JSON with a 30-day TTL; `cache.prune()` on start-up deletes expired rows and caps the table at 5 MB. Covers: on save, download the chosen cover with `expo-file-system` (install with `npx expo install expo-file-system`) to `<documentDirectory>/covers/<bookId>.jpg` and store that `file://` URI in `cover_uri`; on web keep the remote URL. Covers are fetched only on user action (save or explicit refresh).
- **Files:** `src/db/migrations/0002_api_cache.ts`, `src/db/repositories/apiCache.ts`, `src/services/http/cache.ts`, `src/services/covers/{downloadCover.native,downloadCover.web}.ts`.
- **Acceptance:** second identical lookup makes zero network calls; expired entry refetched; deleting a book deletes its cover file.
- **Tests:** `src/db/repositories/__tests__/apiCache.test.ts`, `src/services/http/__tests__/cache.test.ts`, `src/services/covers/__tests__/downloadCover.test.ts` (mocked file system).
- **Delivered:** `api_cache` columns are `NOT NULL` with an index on `fetched_at`. `apiCacheRepo` has `getEntry`, `putEntry`, `deleteEntry`, `clear`, `stats` (bytes, not characters), `prune({ now, maxAgeMs, maxBytes })` (expired rows, then oldest first until under 5 MB, in one window-function query) and `store(db)`. Services cannot import `src/db`, so the HTTP cache is `createResponseCache(store)` in `src/services/http/cache.ts`, given to `createHttpClient({ cache })`; `getJson(url, { cacheTtl })` answers from it with no network and stores successful bodies (not 404s); storage errors count as a miss. Both providers pass a 30-day `cacheTtl`. `DatabaseProvider` prunes after migrating, without delaying start-up. Covers: `downloadCover(bookId, url, { http, signal })` goes through the HTTP client (same etiquette) and writes with the SDK 57 `File`/`Directory`/`Paths` API (`expo-file-system` 57.0.7); per the platform-file convention the files are `downloadCover.ts` (native) and `downloadCover.web.ts`. The caller stores the returned URI in `cover_uri` (services do not write the database). **Not wired yet:** deleting a book's cover file is `deleteCover(bookId)`, but the delete flow is P01-11, whose 6-second undo means it must call `deleteCover` only once the undo window has passed.

### P02-10 Offline handling and pending lookups — done

- **Description:** Migration `0003_pending_lookups` adds `pending_lookups(isbn13 TEXT PRIMARY KEY, requested_at TEXT, attempts INTEGER, last_error TEXT)`. When a lookup fails with `OfflineError`, the caller can queue the ISBN. `usePendingLookups()` retries the queue when the app returns to the foreground (`AppState`), one at a time, and notifies the user (Booky *sleepy* → *excited*) when results arrive; the user then confirms each via the candidate UI. Queue visible in Settings (P08-01) and as a banner on the Shelf ("2 books waiting for details").
- **Files:** `src/db/migrations/0003_pending_lookups.ts`, `src/db/repositories/pendingLookups.ts`, `src/features/lookup/usePendingLookups.ts`, `src/components/book/PendingBanner.tsx`.
- **Acceptance:** offline lookup queues once (no duplicates); retry succeeds when online; attempts capped at 5 with a friendly failure.
- **Tests:** `src/db/repositories/__tests__/pendingLookups.test.ts`, `src/features/lookup/__tests__/usePendingLookups.test.tsx`.
- **Delivered:** everything but the banner. `pending_lookups` has `NOT NULL` defaults and `CHECK (length(isbn13) = 13)`; `pendingLookupsRepo` has `enqueue` (returns false if already queued), `get`, `list`, `listDue`, `listFailed`, `recordFailure` (capped at `MAX_LOOKUP_ATTEMPTS` = 5), `markFailed`, `resetAttempts`, `remove`, `countDue`. `usePendingLookups({ lookup? })` returns `{ pending, failed, results, retrying, queue, retryNow, dismissResult, remove }`: it retries on mount (a cold start reports no `AppState` change) and whenever `AppState` becomes `active`, one ISBN at a time; an `OfflineError` stops the run without counting an attempt; other errors count; "no provider knows this ISBN" and invalid ISBNs give up at once. Booky: *sleepy* "Saved — I'll look this up when you're back online." on `queue`, *excited* when details arrive, *concerned* "…You can add it by hand." on giving up. The app wiring is `src/features/lookup/metadataService.ts` (`getLookupServices(db)`, `useMetadataService()`): one app-wide rate limiter, the native User-Agent, the `api_cache` store and the `googleBooksEnabled` setting. **Left for the UI cards:** `src/components/book/PendingBanner.tsx` ("2 books waiting for details") and the Settings list (P08-10); `countDue` and `pending` are ready for them. PLAN §5 now lists both new tables.

### P02-11 "Look up by ISBN" and "Search online" in the add flow

- **Description:** On `book/new`, a top section: ISBN field + "Look up" button and a "Search online" field (title/author). Results show as `CandidateCard`s (cover, title, authors, year, publisher, format, source badge). Choosing one prefills `BookForm` (authors, genres from normaliser, series hint, summary trimmed with `briefSummary()`) for review before saving; `source`/`source_id` recorded; after the save, `attachCoverFromCandidate` (P02-15) stores the candidate's best real cover. Loading state uses Booky *thinking*; no results → Booky *concerned* + "Add it by hand". The candidate → draft mapping is `candidateToDraft()`.
- **Files:** `src/app/book/new.tsx`, `src/components/book/CandidateCard.tsx`, `src/components/book/CandidateList.tsx`, `src/features/lookup/useLookup.ts`, `src/domain/candidateToDraft.ts`, `src/domain/summary.ts`.
- **Acceptance:** lookup of a fixture ISBN pre-fills every mapped field; cancelling mid-lookup aborts the request; user edits before save are kept.
- **Tests:** `src/features/lookup/__tests__/useLookup.test.tsx`, `src/domain/__tests__/candidateToDraft.test.ts`, `src/domain/__tests__/summary.test.ts`, `src/__tests__/bookNew.lookup.test.tsx`.

### P02-12 Refresh details for an existing book

- **Description:** Book detail overflow → "Refresh details". Looks up by ISBN (or search by title/author when no ISBN) and shows a field-by-field diff ("Summary: add", "Pages: 320 → 336"); the user ticks what to apply. Genres with `user_edited = 1` are never removed.
- **Files:** `src/app/book/[id]/refresh.tsx`, `src/domain/draftDiff.ts`, `src/features/lookup/useRefresh.ts`.
- **Acceptance:** only ticked fields change; user-edited genres preserved.
- **Tests:** `src/domain/__tests__/draftDiff.test.ts`, `src/__tests__/bookRefresh.test.tsx`.

### P02-13 Auto test suite API mocking and recorded fixtures — done

- **Description:** Add API mocking to the existing auto test suite (`tools/auto-test-suite`). A new global flag `--mock-api <dir>` (declared with the other global flags in `tools/auto-test-suite/src/cli.ts` and passed to every command and journey run) points at a fixture directory with a URL → file index (`index.json`: URL pattern, status, content type, body file, optional `expected: true` for deliberate error responses). Journeys use `src/services/metadata/__fixtures__` by default, so `smoke` needs no extra flag; `--mock-api off` disables it. It plugs in where the browser context is created in `tools/auto-test-suite/src/browser/`: a `context.route()` handler (new `tools/auto-test-suite/src/mockapi/` module) is registered before the page is opened, so it covers the first request of every command and journey. Requests to `openlibrary.org`, `covers.openlibrary.org` and `www.googleapis.com` are fulfilled from the index; any other request that leaves the base URL's origin, and any unindexed URL on those hosts, is aborted and reported by the `network` gate under a new rule `unmocked` with the URL, so real external calls fail journeys. Fixture responses marked `expected` (404 for an unknown ISBN, 500 for the partial-failure journey) are exempt from the `network` and `console` gates in the same way as URLs carrying the `__expected-404` marker today; every other status ≥ 400 still fails. Add `scripts/record-fixture.mjs <url>` to record a new fixture (run manually, respects the API etiquette, strips nothing personal because nothing personal is sent). Document the flag in the tool README.
- **Files:** `tools/auto-test-suite/src/mockapi/` (new), `tools/auto-test-suite/src/browser/`, `tools/auto-test-suite/src/cli.ts`, the network and console gates in `tools/auto-test-suite/src/uxgates/`, `tools/auto-test-suite/README.md`; `src/services/metadata/__fixtures__/index.json`; `scripts/record-fixture.mjs`.
- **Acceptance:** P02 journeys pass with no external network (verified by running them offline); an unindexed URL fails the run with a `network`/`unmocked` finding that names it; a deliberate fixture 404 does not.
- **Tests:** unit tests for the index loader and URL matcher (run by `npm run autotest:check`); the journeys below.
- **Delivered:** `tools/auto-test-suite/src/mockapi/` — `index.ts` (load and validate `index.json`, match URLs with query parameters in any order and `*` patterns, classify requests) and `route.ts` (one `context.route()` per page with a URL predicate, registered in `Browser.newPage` before anything navigates). `--mock-api` defaults to `src/services/metadata/__fixtures__`; `off` turns it off, in which case covers are still answered by the test JPEGs as before. Covers: an index entry wins, otherwise `browser/covers.ts`. Aborted requests are remembered per browser context, so the `network` gate reports them as `unmocked` (with the URL and a hint to record a fixture) instead of `request-failed`; responses from entries marked `expected` are skipped by the network gate and by the console gate (Chromium's "Failed to load resource" line carries the URL). The index loader refuses a status ≥ 400 without `expected`. The index serves every recording the Jest tables serve, checked by `src/services/metadata/__tests__/mockIndex.test.ts`, plus a few entries only journeys use (Google Books 500 for Moving Pictures, the partial-failure journey; empty Google Books answers for the other recorded ISBNs). New real recordings made with `scripts/record-fixture.mjs` (September 2026): The Farthest Shore (`9780140306941`: edition, work, author), and the free-text searches `colour of magic pratchett` and `the colour of magic terry pratchett` (the lookup field and the typed cover text send free text); they are in the Jest tables too. Gate self-tests: `network-unmocked` (fires `network/unmocked`) and `clean-mock-expected` (a fixture 404 marked expected fires nothing). "Offline" was verified by the mock itself: with it on, any request that would leave the machine is aborted and fails the gate, and every journey passes with `--ux-gates fail`.

### P02-14 Cover resolution chain — done

- **Description:** Real cover art is the golden path (PLAN §6 "Covers: real art first"). Given a merged candidate or a stored book, list the places a cover can come from, best first: Open Library edition cover id, work cover id, cover by ISBN-13 then ISBN-10 with `default=false`, then Google Books upgraded to its largest reliable size (only when Google Books is enabled). Download and validate each (404, non-image content type, unreadable bytes, 1×1 placeholders, under 150 px tall, absurd shapes), stop at the first good one and otherwise keep the best: portrait over square (padded) over odd, then larger. The result states its source and size.
- **Files:** `src/services/covers/{coverUrls,coverSource,imageSize,validateCover,resolveCover}.ts`, `src/services/metadata/{types,candidate,merge,openLibraryMap,googleBooksMap}.ts`.
- **Acceptance:** chain order, validation and the Google URL upgrade table-tested with tiny generated JPEG/PNG/GIF fixtures and injected fetch; a live run over real ISBNs picks real covers.
- **Tests:** `src/services/covers/__tests__/{coverUrls,imageSize,validateCover,resolveCover}.test.ts`, `src/services/metadata/__tests__/merge.test.ts`.
- **Delivered:** `BookCandidate.coverRefs` keeps each provider's pointers apart (`olEditionCoverIds`, `olWorkCoverIds` with Open Library's `-1` dropped, `googleVolumeId`, `googleImageUrl` as sent) and `mergeCandidates` merges them field by field; `coverUrl` stays for display. `coverSourceFromCandidate` / `coverSourceFromBook` (a stored Open Library book uses its edition id: `/b/olid/{OLID}-L.jpg?default=false`, verified to return the edition's own cover) / `combineCoverSources` build the input; `coverCandidates(source, { includeGoogle })` de-duplicates URLs and derives the missing ISBN form. `readImageSize(bytes)` reads JPEG (walking segments past JFIF/Exif, fill bytes and marker-only segments to any SOF), PNG, GIF and WebP headers. `resolveCover(source, { http, signal, includeGoogle, maxFetches = 4, minHeight = 150 })` fetches through the app's HTTP client (`getBinary`, so the User-Agent and per-host queue apply), stops at a portrait cover ≥ 400 px tall, returns `{ cover, tried }` where `cover` carries `origin`, `url`, `width`, `height`, `shape` and the bytes, and rejects with `OfflineError` only when nothing answered and `RateLimitedError` when nothing was found but a source refused, so "no cover exists" is never confused with "try later". **Google Books, tested live (September 2026) on books.google.com's image server**, which answers even while the keyless Books API is quota-blocked: `zoom=1&fife=w800` returns the same cover up to 800 px wide (128×200 → 800×1247; `fife=w1200` gave 1200×1871), never past the scan's own size; `zoom=0` is unreliable (full size for one volume, a cropped detail of the art for another, a 575×92 strip, an "image not available" PNG); `vid=ISBN…` returned an unrelated book's cover for an unknown ISBN, so it is not used; Google's grey "no cover" thumbnail (128×184) ignores `fife`, so a Google image narrower than 256 px after asking for 800 is rejected. The server sends no CORS headers, so on web a Google cover counts as unreachable and the chain uses Open Library only (Open Library's cover redirects carry `Access-Control-Allow-Origin`). The fixture fetch (`src/testing/fixtureFetch.ts`) can now serve binary bodies.

### P02-15 Store the best cover when saving from a lookup — done

- **Description:** When a book is created from a lookup candidate, run the cover chain and store the winner through the existing `downloadCover` path (a file under `covers/` on native, the remote URL on web). A missing or failed cover never fails the save; the book keeps its generated cover.
- **Files:** `src/features/covers/attachCover.ts`, `src/features/covers/index.ts`.
- **Acceptance:** the downloaded bytes are stored without a second request; `cover_uri` is set; an existing cover (the user's photo) is never overwritten unless asked; empty and failed searches are recorded for the backfill; offline records nothing.
- **Tests:** `src/features/covers/__tests__/attachCover.test.ts`.
- **Delivered:** `attachBestCover(db, bookId, source, { http, signal, includeGoogle, replace, now, downloadCover })` returns `attached` (with the cover's source and size), `kept`, `none`, `offline` or `failed`, and throws only `AbortError`; it hands `downloadCover` an HTTP stand-in that answers the chosen URL from the bytes already validated. `attachCoverFromCandidate(db, bookId, candidate, { signal, replace })` wires it to the app's HTTP client and the `googleBooksEnabled` setting: **P02-11 and P03-09 call it after saving** (the book form's `onFindCoverOnline` hook from P01-10 can use `attachBestCover` with `replace: true`). Not yet called from a screen, because neither save-from-candidate flow exists yet.

### P02-16 Cover backfill with backoff — done

- **Description:** Books with no `cover_uri` (typed in by hand, or saved when no cover was found) get another look when online: an ISBN lookup, or a title + author search, for cover ids, then the chain. Record attempts so the APIs are never hammered.
- **Files:** `src/db/migrations/0004_cover_attempts.ts`, `src/db/repositories/coverAttempts.ts`, `src/domain/coverBackoff.ts`, `src/features/covers/backfillCovers.ts`, `src/features/lookup/usePendingLookups.ts`.
- **Acceptance:** a book is not searched again before its retry time; the wait grows with each empty search; offline stops the run without recording anything; a search result is used only when it matches the book's title and first author.
- **Tests:** `src/domain/__tests__/coverBackoff.test.ts`, `src/db/repositories/__tests__/coverAttempts.test.ts`, `src/features/covers/__tests__/{backfillCovers,wiring}.test.ts`, `src/features/lookup/__tests__/usePendingLookups.test.tsx`.
- **Delivered:** migration `0004_cover_attempts` (`book_id` primary key cascading on delete, `attempts`, `last_attempt_at`, `retry_after`, `last_result` `none`/`error`, `last_error`; indexed on `retry_after`; derived data, to be left out of backups like `api_cache`). `coverAttemptsRepo`: `listBooksNeedingCover(db, { now, limit })` (no cover, never searched first and newest first, with the first credited author), `recordAttempt`, `get`, `clear`. Backoff (`COVER_RETRY_DELAYS`): an empty search waits 1, 7, 30, then every 90 days; a failed one 1 h, 6 h, 1 day, then 7 days. `backfillCovers(db, { limit = 5, lookupIsbn, search, … })` handles one book at a time through the shared rate limiter and returns `{ checked, attached, none, failed, offline }`; a book without an ISBN is searched only when it has an author, and a result is trusted only when `bookMatchKey(title, first author)` matches. `backfillCoversNow(db)` wires it to the app services. `usePendingLookups` starts it in the background after an online retry of the queue and on mount when nothing is queued (one run at a time, cancelled on unmount; `backfillCovers: null` turns it off). This is the one exception to "covers only on a user action" in P02-09, bounded as PLAN §6's etiquette table says. **Not running in the app yet:** `usePendingLookups` is mounted by the P02-10 banner / P02-11 screens, which are still to come; mounting it will also start the backfill.

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
