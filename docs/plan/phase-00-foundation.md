# Phase 00 — Foundation

## Goal

Everything later phases build on: the Expo app skeleton with routing and a web target, the design system (tokens, fonts, UI primitives), Booky, tab navigation, the SQLite data layer with the v1 schema, the three test harnesses (Jest, the auto test suite, Maestro) and CI. At the end of this phase the app launches into five themed, empty tabs on Android and web, and the regression gate runs in CI.

## Scope

- Project scaffold, Expo Router, web target, Jest, selector contract, repo and commit hook (already on `main`).
- Theme tokens and fonts; UI primitives; Booky component with expressions and bubble.
- Bottom tabs: Shelf, Scan, Loans, Groups, Settings (placeholder content with page-state markers).
- `Db` interface, `expo-sqlite` and Node adapters, migration runner, initial schema migration, domain models and base repositories.
- The auto test suite (`tools/auto-test-suite`): core, UX gates, commands and first journeys (delivered), plus follow-ups P00-21..P00-29.
- Maestro setup and a launch flow.
- GitHub Actions CI and linting.

## Out of scope

- Any real feature screen (Phase 01+).
- Network calls (Phase 02). Camera and OCR (Phase 03).
- Dark theme (P09-02).

## Prerequisites

- Node 22+ and npm; Go (version in `tools/auto-test-suite/go.mod`, currently 1.26.3) and a one-time `npm run autotest:install-browser` for the auto test suite; Android Studio emulator or a device with USB debugging for Maestro; Maestro CLI installed (`curl -fsSL "https://get.maestro.mobile.dev" | bash`).
- `git config core.hooksPath .githooks` run once in the clone.

## Notes for implementers

The auto test suite (P00-15, P00-16, P00-17) and CI (P00-19) are on `main`; their cards below describe what was delivered, and [`tools/auto-test-suite/README.md`](../../tools/auto-test-suite/README.md) is the reference for its flags, gates and journeys. Cards P00-08…P00-14, P00-18 and P00-20 are being built in parallel. When they land, the code is the source of truth for exact file names and APIs; if it differs from a path named here or in later phases, update the docs in the same pull request.

---

## Task cards

### P00-01 Scaffold Expo TypeScript app — done

- **Description:** Create the Expo SDK 57 app with TypeScript strict mode, `@/*` path alias to `src/*`, MIT licence, app identity (`MyShelf`, package `dev.asorichetti.myshelf`, scheme `myshelf`), adaptive icon background `#EDE4F7`.
- **Files:** `package.json`, `app.json`, `tsconfig.json`, `assets/*`, `LICENSE`, `.gitignore`.
- **Acceptance:** `npm run typecheck` passes; `npx expo start` serves the app.
- **Tests:** covered by P00-04.

### P00-02 Expo Router with routes in `src/app` — done

- **Description:** `expo-router` as entry (`"main": "expo-router/entry"`), root stack in `src/app/_layout.tsx`, placeholder home at `src/app/index.tsx`, typed routes enabled.
- **Files:** `src/app/_layout.tsx`, `src/app/index.tsx`, `app.json` (`plugins`, `experiments.typedRoutes`).
- **Acceptance:** app opens on the home screen showing "MyShelf".
- **Tests:** `src/__tests__/home.test.tsx`.

### P00-03 Web target — done

- **Description:** `react-native-web`, `react-dom`, `@expo/metro-runtime`; Metro web bundler with single-page output; scripts `web` and `export:web`.
- **Files:** `package.json`, `app.json` (`web`).
- **Acceptance:** `npm run web` renders the home screen in a browser; `npm run export:web` writes `dist/`.
- **Tests:** the `home-loads` and `home-responsive` journeys (P00-17) run against the web build.

### P00-04 Jest with jest-expo and Testing Library — done

- **Description:** `jest-expo` preset, `@testing-library/react-native`, `tools/` ignored by Jest, `npm test`.
- **Files:** `package.json` (`jest` block), `src/__tests__/home.test.tsx`.
- **Acceptance:** `npm test` passes with the home screen test.
- **Tests:** `src/__tests__/home.test.tsx`.

### P00-05 Selector contract and generator — done

- **Description:** `src/testing/selectors.json` → `scripts/gen-selectors.mjs` → `src/testing/testids.gen.ts` and `tools/auto-test-suite/internal/selectors/selectors.gen.go`; validation (camelCase keys, kebab-case unique ids); `--check` mode; `npm run check` = `selectors:check` + `typecheck` + `test --ci`.
- **Files:** as listed.
- **Acceptance:** editing `selectors.json` without regenerating makes `npm run selectors:check` exit 1.
- **Tests:** the `--check` run in `npm run check`.

### P00-06 Public GitHub repository — done

- **Description:** Public repo `asorichetti/MyShelf`, MIT licence, `main` as default branch.
- **Acceptance:** repo is public; `LICENSE` present.

### P00-07 Commit-msg hook — done

- **Description:** `.githooks/commit-msg` rejects commit messages that attribute work to an AI tool or assistant ([ADR 0010](../adr/0010-commit-conventions-no-ai-attribution.md)).
- **Files:** `.githooks/commit-msg`.
- **Acceptance:** with `git config core.hooksPath .githooks`, a message containing an attribution trailer is rejected.
- **Tests:** manual check documented in `AGENTS.md`; CI check of pushed commit messages in P00-23.

### P00-08 Design tokens and fonts

- **Description:** Implement the tokens from `PLAN.md` §9: colours (light theme), typography (Lora, Nunito, Courier Prime via `@expo-google-fonts/*`), spacing, radii, elevation, motion. Export a typed `theme` object and a `useTheme()` hook (ready for a dark token set in P09-02). Load fonts at the root layout, keeping the splash screen up until they are ready. On web, write every token to `:root` as `--ms-*` custom properties (e.g. `--ms-color-primary: #6B3FA8`).
- **Files:** `src/theme/tokens.ts`, `src/theme/index.ts`, `src/theme/fonts.ts`, `src/theme/cssVars.web.ts` (+ `.ts` no-op), `src/app/_layout.tsx`; deps via `npx expo install @expo-google-fonts/lora @expo-google-fonts/nunito @expo-google-fonts/courier-prime expo-splash-screen`.
- **Acceptance:**
  - No colour hex literal outside `src/theme` in `src/components` or `src/app` (grep check in the test).
  - Every text/background pair listed as text in `PLAN.md` §9 has contrast ≥ 4.5:1, computed in a unit test.
  - On web, `getComputedStyle(document.documentElement).getPropertyValue('--ms-color-primary')` returns `#6B3FA8`.
- **Tests:** `src/theme/__tests__/contrast.test.ts` (WCAG ratio helper + all pairs), `src/theme/__tests__/tokens.test.ts` (shape, CSS var names), `src/theme/__tests__/no-hardcoded-colours.test.ts`.

### P00-09 UI primitives

- **Description:** Themed, accessible building blocks: `Text` (variants `display`, `title`, `heading`, `body`, `caption`, `mono`), `Button` (`primary`, `secondary`, `ghost`, `danger`; loading and disabled states), `IconButton` (required `accessibilityLabel`), `Card` and `CatalogueCard` (cream, red rule, ruled lines), `TextField` (label, hint, error, `borderStrong` outline), `Chip`, `Stamp` (rotated Courier Prime label with `tone`), `Screen` (safe area + page-state wrapper that renders `pageState.loading` / `pageState.content` / `pageState.error` test ids), `EmptyState` (slot for Booky), `ConfirmDialog`, `Snackbar`.
- **Files:** `src/components/ui/*.tsx`, `src/components/ui/index.ts`.
- **Acceptance:** each component uses tokens only; touch targets ≥ 48 dp; every interactive component exposes `role`/`accessibilityRole` and a label; `Screen` renders exactly one page-state marker.
- **Tests:** `src/components/ui/__tests__/*.test.tsx` — render, variants, disabled/loading, labels, `Screen` state switching.

### P00-10 Booky component, bubble and hook

- **Description:** Booky as an SVG (`react-native-svg`, installed with `npx expo install react-native-svg`) — a purple bookmark with a tassel, eyes and mouth — with `expression: 'happy' | 'thinking' | 'excited' | 'sleepy' | 'concerned'` and `size`. `BookyBubble` shows a message, optional action button and dismiss button. `useBooky()` exposes `say({ id, text, expression, action? })`, `dismiss()` and the current message via a `BookyProvider` at the root. Booky's graphic is hidden from assistive tech; bubble text is announced politely. Idle bob/blink animations respect reduce-motion.
- **Files:** `src/components/booky/Booky.tsx`, `BookyBubble.tsx`, `BookyProvider.tsx`, `useBooky.ts`, `expressions.ts`, `index.ts`.
- **Acceptance:** all five expressions render distinctly (snapshot of SVG paths per expression); dismiss button has label "Dismiss Booky's tip"; no animation when reduce-motion is on.
- **Tests:** `src/components/booky/__tests__/Booky.test.tsx`, `BookyBubble.test.tsx`, `useBooky.test.tsx`.

### P00-11 Bottom tabs and placeholder screens

- **Description:** Replace the placeholder home with a tab navigator in `src/app/(tabs)/`: Shelf (`index`), Scan, Loans, Groups, Settings, each a `Screen` with a title and an `EmptyState` with Booky. Themed tab bar (tint background, primary active colour, icons + labels, 48 dp targets). Add `pageState.loading` to `selectors.json`. Remove or redirect `src/app/index.tsx` so `/` is the Shelf tab.
Removing the `home` selector group also removes `selectors.Home` from the generated Go package, which the `home-loads` and `home-responsive` journeys use: retarget both at the Shelf tab (`selectors.Shelf.*`) in the same change so the auto test suite still builds and `smoke` stays green.
- **Files:** `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/index.tsx`, `scan.tsx`, `loans.tsx`, `groups.tsx`, `settings.tsx`; `src/app/_layout.tsx`; `src/testing/selectors.json`; update `src/__tests__/home.test.tsx` → `src/__tests__/tabs.test.tsx`; `tools/auto-test-suite/internal/journeys/home.go`.
- **Acceptance:** every tab reachable by tap and by URL on web (`/`, `/scan`, `/loans`, `/groups`, `/settings`); active tab announced as selected; each screen renders `page-content`; `npm run autotest:check` and `npm run -s autotest:smoke` pass.
- **Tests:** `src/__tests__/tabs.test.tsx` (each tab renders its root id and title).

### P00-12 `Db` interface and adapters

- **Description:** Define `Db` (`exec`, `run` → `{ lastInsertRowId, changes }`, `get<T>`, `all<T>`, `transaction<T>(fn)`), an `expo-sqlite` adapter (async API, `PRAGMA foreign_keys = ON`, WAL on native), a Node adapter for Jest on `node:sqlite` (`better-sqlite3` fallback), `openDatabase()` for the app and `createTestDb()` for tests (in-memory, migrations applied). Provide the db to React via `DbProvider`/`useDb()`, showing `page-loading` until migrations finish and `page-error` on failure. On web, confirm the `expo-sqlite` web build works under the auto test suite against the Expo dev server (it needs `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy` headers; configure them for the dev server here, and P00-22 adds them to `--serve` for the exported build); if not, document and add a web adapter behind the same interface.
- **Files:** `src/db/Db.ts`, `src/db/expoDb.ts`, `src/db/nodeDb.ts`, `src/db/open.ts`, `src/db/DbProvider.tsx`, `src/testing/createTestDb.ts`.
- **Acceptance:** the same repository test passes on the Node adapter; a failing statement inside `transaction` rolls back; foreign keys enforced.
- **Tests:** `src/db/__tests__/nodeDb.test.ts`, `src/db/__tests__/transaction.test.ts` (both `@jest-environment node`).

### P00-13 Migration runner and initial schema

- **Description:** Forward-only migrations in `src/db/migrations` (`0001_init` …) as TS modules exporting SQL, applied in a transaction each, version tracked with `PRAGMA user_version`. `0001_init` creates every table in `PLAN.md` §5 with foreign keys, `ON DELETE` rules, indexes (`books(isbn13)`, `books(series_id, series_position)`, `book_authors(author_id)`, `book_genres(genre_id)`, `group_books(book_id)`, `loans(borrower_id)`), `genres.name UNIQUE COLLATE NOCASE`, and `loans_one_open_per_book` partial unique index.
- **Files:** `src/db/migrations/index.ts`, `src/db/migrations/0001_init.ts`, `src/db/migrate.ts`.
- **Acceptance:** fresh DB ends at `user_version = 1`; running `migrate` twice is a no-op; inserting a second open loan for a book fails; deleting a book cascades.
- **Tests:** `src/db/__tests__/migrate.test.ts`, `src/db/__tests__/schema.test.ts` (constraints, cascades, partial index).

### P00-14 Domain models and base repositories

- **Description:** Domain types (`Book`, `BookDraft`, `Author`, `Genre`, `Series`, `Group`, `Borrower`, `Loan`, `Setting`) and pure helpers started here: `src/domain/isbn.ts` (normalise, validate ISBN-10/13 checksums, convert 10↔13), `src/domain/dates.ts` (local `YYYY-MM-DD` today, add days, compare), `src/domain/authors.ts` (`sortName("Terry Pratchett") → "Pratchett, Terry"`). Repositories with CRUD basics: `books`, `authors`, `genres`, `series`, `groups`, `borrowers`, `loans`, `settings` (typed keys with defaults). Mapping row ↔ domain in one place per repository.
- **Files:** `src/domain/*.ts`, `src/db/repositories/*.ts`, `src/db/repositories/index.ts`.
- **Acceptance:** each repository round-trips its entity; `loans.lend` on a book with an open loan throws `BookAlreadyOnLoanError`; settings return defaults when unset.
- **Tests:** `src/domain/__tests__/isbn.test.ts` (valid/invalid, X check digit, 978/979), `dates.test.ts`, `authors.test.ts`; `src/db/repositories/__tests__/*.test.ts`.

### P00-15 Auto test suite core — done

- **Description:** Go module `github.com/asorichetti/MyShelf/tools/auto-test-suite` (Cobra root command, playwright-go driving Chromium). Global flags: `--env` (`local` = `http://localhost:8081`), `--base-url` (overrides `--env`), `--headless` (default true when `CI` is set or there is no display; false on macOS), `--screenshot-dir` (default `./screenshots`), `--ux-gates off|warn|fail` (default `warn`), `--viewport mobile|tablet|desktop` (390×844, 820×1180, 1280×900; default `mobile`; `AUTOTEST_VIEWPORT_HEIGHT` overrides the height), `--color-scheme light|dark|no-preference`, `--gates-config`, `--console-allowlist`. The `browser` package launches a **fresh browser, context and page per run**, attaches console and network listeners before navigating, and writes an evidence bundle per command or journey to `<screenshot-dir>/<command>-<unixMillis>/`: `screenshot.png`, `page.html` (rendered DOM), `console.json`, `network.json` (failed traffic only) and `uxgates.json`. The bundle is written from a `defer`, with `Close()` as a last resort and a placeholder bundle when the browser does not start, so failed runs always leave evidence. stdout is exactly one JSON document per invocation, including usage errors; progress goes to stderr; exit code 1 on failure. Package scripts `autotest:install-browser`, `autotest:build` and `autotest:check`; `bin/` and `screenshots/` are git-ignored. All Go commands run with `GOWORK=off`.
- **Files:** `tools/auto-test-suite/go.mod`, `go.sum`, `main.go`, `README.md`, `internal/cmd/root.go`, `internal/browser/browser.go`, `internal/browser/listeners.go`, `internal/browser/run.go`; `package.json`; `.gitignore`.
- **Acceptance (met):**
  - `npm run autotest:check` (gofmt, `go vet ./...`, `go test ./...`) passes.
  - `auto-test-suite --help` lists the global flags above; an unknown `--viewport`, `--env` or `--ux-gates` value prints `{"command":…,"ok":false,"error":…}` on stdout and exits 1.
  - Every browser run creates a new timestamped run directory holding the five bundle files.
- **Tests:** `internal/cmd/root_test.go` (base URL resolution, URL joining, render viewports covering both ends of the width range).

### P00-16 Auto test suite UX gates — done

- **Description:** Package `uxgates` with five gates that run alongside assertions and record every result, finding and piece of evidence in `uxgates.json`. Per page load `CheckPage` runs `pagestate` (content marker visible within 15 s, no visible `pageState.error`, at least 10 characters of text in the visible `main`), then `render` at the selected viewport and the other end of the width range (rules `stylesheets`, `tokens`, `body-margin`, `body-background`, `body-font`, `text-font`, `fonts-loaded`, `fonts-error`, `images`, `overflow`, `landmarks`, checked through computed styles after `document.fonts.ready`), then `a11y` (rules `one-h1`, `heading-order`, `img-alt`, `accessible-name`, `skip-link`, `one-main`, `nav-labels`, `html-lang`; hidden and `aria-hidden` subtrees ignored). A failed `pagestate` skips `render` and `a11y` for that page. `CheckTraffic` runs `console` (errors and uncaught exceptions not in the allowlist) and `network` (responses ≥ 400 and requests with no response) at the end of the command or journey. Modes `off`/`warn`/`fail`; only `fail` turns findings into a failed run. Configuration is embedded: `gates.config.json` (`render.requiredTokens`, `render.landmarks`, and `disabled` maps where every rule needs a reason; unknown rule ids are rejected at startup) and `console_allowlist.json` (pattern + reason, both required; currently empty). Per-journey waivers (`Gates.Waive(gate, rule, reason)`) downgrade a finding to a recorded warning. `ExpectedMissingMarker` (`__expected-404`) exempts deliberately missing URLs from the console and network gates. Current decisions: `a11y/skip-link` off (mobile app, no repeated block to skip); `render/landmarks` requires `main` only; `render/requiredTokens` empty and `render/body-background`, `render/body-font`, `render/fonts-loaded` off temporarily until the theme and app shell land (P00-25).
- **Files:** `tools/auto-test-suite/internal/uxgates/{gate,check,pagestate,render,a11y,console,network,expected,config}.go`, `gates.config.json`, `console_allowlist.json`.
- **Acceptance (met):**
  - Config with an unknown rule id or a disabled rule without a reason, and an allowlist entry without a reason, are rejected.
  - A waived finding stays in `uxgates.json` as a warning with the reason and the waiver listed.
  - Every gate was shown to fire against a temporary broken route (procedure in the tool README, "Proving the gates fire"); automating that proof is P00-29.
  - `smoke` passes with `--ux-gates fail` against the current app.
- **Tests:** `internal/uxgates/gate_test.go` (mode parsing, fail-mode errors, warn severity, config and allowlist validation, expected-missing marker, waivers).

### P00-17 Auto test suite commands, journeys and package scripts — done

- **Description:** Commands `navigate --url <path> [--wait <ms>] [--marker <selector>]`; `journey <name…> | --all | --suite <suite> | --grep <regexp>`, with `--list` to print the (selected) registry; `smoke` (`journey --suite core` with `--ux-gates fail` and headless unless passed explicitly); `screenshot --url <path> --viewports <list> --schemes <list>` (one browser and bundle per combination); `interact click|fill|press|focus --url <path> (--testid <id> | --selector <sel>) [--value] [--key] [--settle]`, which reports the focused element and its ARIA state. Self-registering journey registry: `register(Journey{Name, Suite, Desc, Run})` from `init()` in `internal/journeys/*.go` (one file per area), sorted and duplicate-checked. Journey `Context` helpers: `Goto(path)`, `GotoMarker(path, marker)`, `Snap(name)`, `URL(path)`, `Page`, `Gates`; assertions with `expect(cond, format, …)`, whose messages say what was expected and what was found. First journeys: `home-loads` (core), `not-found` (core; uses the expected-missing marker and waives `a11y/one-main` and `render/landmarks` for Expo Router's built-in screen), `home-responsive` (responsive). Package scripts `autotest:smoke` (build + `smoke`) and `autotest:journeys` (build + `journey --all`).
- **Files:** `tools/auto-test-suite/internal/cmd/{navigate,journey,smoke,screenshot,interact}.go`, `internal/journeys/{journeys,helpers,home,notfound}.go`; `package.json`.
- **Acceptance (met):**
  - `auto-test-suite journey --list` prints JSON listing `home-loads`, `home-responsive` and `not-found` with their suites.
  - With the web server running (`CI=1 npx expo start --web --port 8081`), `npm run -s autotest:smoke` passes 2/2 and `npm run -s autotest:journeys -- --ux-gates fail` passes 3/3.
- **Tests:** `internal/journeys/journeys_test.go` (registry sorted, `core` suite non-empty, duplicate names panic, `expect` message format); the journeys themselves.

### P00-18 Maestro setup

- **Description:** `.maestro/config.yaml`, a shared `appId: dev.asorichetti.myshelf`, and a `launch.yaml` flow that launches the app, asserts each tab by id and taps through them. Document how to run on an emulator in `.maestro/README.md` (development build from P03-01; until then, a local `npx expo run:android` build).
- **Files:** `.maestro/config.yaml`, `.maestro/launch.yaml`, `.maestro/README.md`.
- **Acceptance:** `maestro test .maestro/launch.yaml` passes on an Android emulator.
- **Tests:** the flow itself.

### P00-19 GitHub Actions CI — done

- **Description:** `.github/workflows/ci.yml` on push to `main` and on every pull request, with read-only permissions and one run per ref (older runs cancelled). Job **App checks**: Node 23 with npm cache, `npm ci`, `npm run check`. Job **auto-test-suite smoke** (`GOWORK=off`, Go from `go.mod` with module cache): gofmt, `go vet ./...`, `go test ./...`, `go build`, install Chromium with system dependencies, `npm ci`, start the Expo web server on 8081 (`CI=1 npx expo start --web`) and wait for it, run `auto-test-suite smoke --ux-gates fail --headless=true` and `auto-test-suite journey --suite responsive --ux-gates fail --headless=true`, and on failure upload `screenshots/` plus the Expo log as the `auto-test-suite-screenshots` artifact (14-day retention).
- **Files:** `.github/workflows/ci.yml`.
- **Acceptance (met):** both jobs run on every push to `main` and every pull request; a gate failure or failing journey fails the job and uploads the evidence bundles; the same steps pass locally (`npm run check`, `npm run autotest:check`, `npm run -s autotest:smoke`).
- **Tests:** CI itself. Follow-ups: checking pushed commit messages (P00-23), running every journey rather than named suites (P00-24), and running against the exported build with `--serve` (P00-22).

### P00-20 Linting

- **Description:** ESLint via `npx expo lint` (creates the Expo config), plus rules: no raw colour literals outside `src/theme`, import order, `react-hooks`. Prettier-compatible formatting. Add `lint` script and include it in `check`.
- **Files:** `eslint.config.js`, `package.json`.
- **Acceptance:** `npm run lint` clean; `npm run check` runs lint.
- **Tests:** CI.

---

## Test ids to add to `selectors.json`

```json
{
  "pageState": { "content": "page-content", "error": "page-error", "loading": "page-loading" },
  "tabs": {
    "shelf": "tab-shelf", "scan": "tab-scan", "loans": "tab-loans",
    "groups": "tab-groups", "settings": "tab-settings"
  },
  "shelf": { "root": "shelf-root", "title": "shelf-title" },
  "scan": { "root": "scan-root", "title": "scan-title" },
  "loans": { "root": "loans-root", "title": "loans-title" },
  "groups": { "root": "groups-root", "title": "groups-title" },
  "settings": { "root": "settings-root", "title": "settings-title" },
  "booky": { "avatar": "booky-avatar", "bubble": "booky-bubble", "bubbleText": "booky-bubble-text", "dismiss": "booky-dismiss", "action": "booky-action" },
  "emptyState": { "root": "empty-state", "action": "empty-state-action" }
}
```

The existing `home` group is removed when P00-11 replaces the home screen (update tests in the same commit).

## Auto test suite journeys

Run with `auto-test-suite journey <name>` (after `npm run autotest:build`), or all at once with `npm run -s autotest:journeys -- --ux-gates fail`.

| Journey | Suite | Checks | Card |
|---|---|---|---|
| `home-loads` | `core` | `/`: `home.title` is an `h1` "MyShelf" inside the single `main`, font-weight 700, not the default serif; document title "MyShelf" | P00-17 (done) |
| `not-found` | `core` | `/missing-shelf__expected-404` renders Expo Router's not-found screen (h1 "Unmatched Route") and stays on that URL | P00-17 (done) |
| `home-responsive` | `responsive` | viewport meta `width=device-width, initial-scale=1`; at mobile, tablet and desktop the title is fully on screen and nothing scrolls sideways; one screenshot per width | P00-17 (done) |
| `tabs-navigate` | `core` | open `/`; for each tab: click `tabs.<tab>`, expect `<tab>.root` and the tab marked selected, `Snap` a screenshot | P00-26 |
| `booky-empty-shelf` | `core` | open `/`; expect `booky.avatar` and `emptyState.root` | P00-26 |
| `theme-tokens` | `p00` | open `/`; `--ms-color-primary` resolves to `#6B3FA8` on `:root`; body background and font come from the tokens | P00-25 |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/launch.yaml` | app launches, splash dismissed, each tab reachable by tap, Android back from a tab exits to launcher from Shelf |

## Risks

| Risk | Mitigation |
|---|---|
| `expo-sqlite` web build needs cross-origin isolation (SharedArrayBuffer) | dev server headers configured in P00-12; `--serve` sends them for the exported build (P00-22); fallback web adapter behind `Db` |
| Cross-origin isolation blocks remote cover images on web | use `Cross-Origin-Embedder-Policy: credentialless` (Chromium) or serve fixture covers locally in tests |
| `node:sqlite` API differences between Node versions | pin the Node version in CI; `better-sqlite3` fallback |
| Fonts not loaded before first render → layout shift in screenshots | keep splash until fonts load; `pagestate` gate waits for `page-content` |
| react-native-web or framework markup trips a gate rule the app cannot fix | a per-journey waiver (`Gates.Waive`) or a `disabled` entry in `gates.config.json`, each with a written reason and recorded in `uxgates.json`; console errors only via the reviewed allowlist (pattern + reason) |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI (the web server must be running: `CI=1 npx expo start --web --port 8081`):

```bash
npm run check                    # selectors:check + typecheck + Jest (+ lint once P00-20 lands)
npm run -s autotest:smoke        # builds the auto test suite and runs `smoke` (core suite, gates fail)
```

Phase close also requires every journey to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- App launches on Android emulator and web into the five themed tabs with Booky in each empty state.
- Fresh database created and migrated to version 1 on first launch.
- `npm run check`, `npm run -s autotest:smoke` and `npm run -s autotest:journeys -- --ux-gates fail` green locally and in CI.
- `maestro test .maestro/launch.yaml` passes on an emulator.
- All P00 cards ticked in `STATUS.md`.
