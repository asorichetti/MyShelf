# Phase 00 — Foundation

## Goal

Everything later phases build on: the Expo app skeleton with routing and a web target, the design system (tokens, fonts, UI primitives), Booky, tab navigation, the SQLite data layer with the v1 schema, the three test harnesses (Jest, auto-test-suite, Maestro) and CI. At the end of this phase the app launches into five themed, empty tabs on Android and web, and the regression gate runs in CI.

## Scope

- Project scaffold, Expo Router, web target, Jest, selector contract, repo and commit hook (already on `main`).
- Theme tokens and fonts; UI primitives; Booky component with expressions and bubble.
- Bottom tabs: Shelf, Scan, Loans, Groups, Settings (placeholder content with page-state markers).
- `Db` interface, `expo-sqlite` and Node adapters, migration runner, initial schema migration, domain models and base repositories.
- auto-test-suite core, gates, commands and first journeys.
- Maestro setup and a launch flow.
- GitHub Actions CI and linting.

## Out of scope

- Any real feature screen (Phase 01+).
- Network calls (Phase 02). Camera and OCR (Phase 03).
- Dark theme (P09-02).

## Prerequisites

- Node 22+ and npm; Go 1.22+ (developed on 1.26) for the auto-test-suite; Android Studio emulator or a device with USB debugging for Maestro; Maestro CLI installed (`curl -fsSL "https://get.maestro.mobile.dev" | bash`).
- `git config core.hooksPath .githooks` run once in the clone.

## Notes for implementers

Phase 00 cards P00-08…P00-20 are being built in parallel. When they land, the code is the source of truth for exact file names and APIs; if it differs from a path named here or in later phases, update the docs in the same pull request.

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
- **Tests:** smoke via auto-test-suite from P00-17.

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
- **Tests:** manual check documented in `AGENTS.md`; optional shell test in P00-19 CI.

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
- **Files:** `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/index.tsx`, `scan.tsx`, `loans.tsx`, `groups.tsx`, `settings.tsx`; `src/app/_layout.tsx`; `src/testing/selectors.json`; update `src/__tests__/home.test.tsx` → `src/__tests__/tabs.test.tsx`.
- **Acceptance:** every tab reachable by tap and by URL on web (`/`, `/scan`, `/loans`, `/groups`, `/settings`); active tab announced as selected; each screen renders `page-content`.
- **Tests:** `src/__tests__/tabs.test.tsx` (each tab renders its root id and title).

### P00-12 `Db` interface and adapters

- **Description:** Define `Db` (`exec`, `run` → `{ lastInsertRowId, changes }`, `get<T>`, `all<T>`, `transaction<T>(fn)`), an `expo-sqlite` adapter (async API, `PRAGMA foreign_keys = ON`, WAL on native), a Node adapter for Jest on `node:sqlite` (`better-sqlite3` fallback), `openDatabase()` for the app and `createTestDb()` for tests (in-memory, migrations applied). Provide the db to React via `DbProvider`/`useDb()`, showing `page-loading` until migrations finish and `page-error` on failure. On web, confirm the `expo-sqlite` web build works under the auto-test-suite (`--serve` must send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy` headers); if not, document and add a web adapter behind the same interface.
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

### P00-15 auto-test-suite core

- **Description:** Go module in `tools/auto-test-suite` (Cobra root command, playwright-go). Config flags `--base-url` (default `http://localhost:8081`), `--serve <dir>` (static server with SPA fallback to `index.html` and cross-origin-isolation headers), `--out` (default `screenshots/`), `--viewport phone|tablet` (phone = 412×915), `--ux-gates off|warn|fail` (default `warn`), `--timeout`. A runner that launches **one fresh browser per journey**, collects console messages and network events, and writes an evidence bundle (`screenshot.png`, `dom.html`, `console.json`, `network.json`, `gates.json`, `result.json`) per command/journey under `<out>/<timestamp>-<command>-<name>/`. stdout is exactly one JSON document; logs to stderr; non-zero exit on failure. Ignore `tools/auto-test-suite/bin/`.
- **Files:** `tools/auto-test-suite/go.mod`, `main.go`, `cmd/root.go`, `internal/runner/*.go`, `internal/evidence/*.go`, `internal/server/*.go`, `.gitignore`.
- **Acceptance:** `go vet ./...` and `go test ./...` pass in `tools/auto-test-suite`; JSON output validates against the documented shape; a bundle folder is created for every run.
- **Tests:** Go unit tests for evidence writer, JSON output, static server (SPA fallback + headers).

### P00-16 auto-test-suite UX gates

- **Description:** Gates run after every navigation and journey step and record pass/fail/details in `gates.json`: `pagestate` (waits for exactly one of `page-content` / `page-error`, allowing `page-loading` first), `render` (non-zero root, not blank, no error overlay, no horizontal overflow), `console` (no `console.error`/page errors; allowlist file), `network` (no failed/≥400 same-origin requests; unmocked external requests fail), `a11y` (axe-core embedded via `go:embed` and injected; fail on `serious`/`critical`; unnamed interactive elements; targets < 44×44 px). `--ux-gates fail` turns gate failures into command failure.
- **Files:** `tools/auto-test-suite/internal/gates/*.go`, `tools/auto-test-suite/internal/gates/axe.min.js` (vendored, with licence header).
- **Acceptance:** each gate has a failing fixture page and a passing one in Go tests.
- **Tests:** `tools/auto-test-suite/internal/gates/*_test.go` using small local HTML fixtures.

### P00-17 auto-test-suite commands, journeys and npm wrapper

- **Description:** Commands `navigate <route>`, `screenshot <route>`, `interact <route> --step '<click|fill|press|wait> <group.key> [value]'`, `journey <name>|--all|--tag|--list`, `smoke` (navigate each tab route + every journey tagged `smoke`). Journey registry with `journeys.Register(Journey{Name, Tags, Run})` called from `init()` in `internal/journeys/*.go`. Journey context helpers: `Goto(route)`, `Click(sel)`, `Fill(sel, text)`, `ExpectVisible(sel)`, `ExpectText(sel, text)`, `Screenshot(name)`. First journeys: `tabs-navigate`. Add npm script `"ui": "go run -C tools/auto-test-suite ."` so the gate is `npm run ui -- smoke --ux-gates fail`.
- **Files:** `tools/auto-test-suite/cmd/*.go`, `tools/auto-test-suite/internal/journeys/registry.go`, `tools/auto-test-suite/internal/journeys/tabs.go`, `package.json`.
- **Acceptance:** `npm run ui -- journey --list` prints JSON listing `tabs-navigate`; `npm run ui -- smoke --ux-gates fail` passes against `npm run web`.
- **Tests:** Go tests for registry and step parsing; the journey itself.

### P00-18 Maestro setup

- **Description:** `.maestro/config.yaml`, a shared `appId: dev.asorichetti.myshelf`, and a `launch.yaml` flow that launches the app, asserts each tab by id and taps through them. Document how to run on an emulator in `.maestro/README.md` (development build from P03-01; until then, a local `npx expo run:android` build).
- **Files:** `.maestro/config.yaml`, `.maestro/launch.yaml`, `.maestro/README.md`.
- **Acceptance:** `maestro test .maestro/launch.yaml` passes on an Android emulator.
- **Tests:** the flow itself.

### P00-19 GitHub Actions CI

- **Description:** `ci.yml` on push and pull request: Node LTS + `npm ci` + `npm run check`; Go setup + `go vet ./...` + `go test ./...` in `tools/auto-test-suite`; `EXPO_PUBLIC_E2E=1 npm run export:web`; install Playwright Chromium; `npm run ui -- smoke --ux-gates fail --serve dist`; upload `screenshots/` as an artifact (always, 7-day retention). Cache npm, Go modules and the Playwright browser. Add a CI step that runs the commit-msg hook against every commit message in the pushed range.
- **Files:** `.github/workflows/ci.yml`.
- **Acceptance:** CI green on a pull request; a deliberately broken selector file fails CI; evidence artifact downloadable.
- **Tests:** CI itself.

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

## auto-test-suite journeys

| Journey | Tags | Steps |
|---|---|---|
| `tabs-navigate` | `smoke`, `p00` | open `/`; for each tab: click `tabs.<tab>`, expect `<tab>.root`, screenshot |
| `theme-tokens` | `p00` | open `/`; assert `--ms-color-primary` and fonts loaded; screenshot |
| `booky-empty-shelf` | `smoke`, `p00` | open `/`; expect `booky.avatar` and `emptyState.root` |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/launch.yaml` | app launches, splash dismissed, each tab reachable by tap, Android back from a tab exits to launcher from Shelf |

## Risks

| Risk | Mitigation |
|---|---|
| `expo-sqlite` web build needs cross-origin isolation (SharedArrayBuffer) | auto-test-suite `--serve` sends the headers; the dev server config documented in P00-12; fallback web adapter behind `Db` |
| Cross-origin isolation blocks remote cover images on web | use `Cross-Origin-Embedder-Policy: credentialless` (Chromium) or serve fixture covers locally in tests |
| `node:sqlite` API differences between Node versions | pin the Node version in CI; `better-sqlite3` fallback |
| Fonts not loaded before first render → layout shift in screenshots | keep splash until fonts load; `pagestate` gate waits for `page-content` |
| axe-core false positives on react-native-web markup | reviewed allowlist in the auto-test-suite, each entry with a reason |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + typecheck + Jest (+ lint once P00-20 lands)
auto-test-suite smoke --ux-gates fail     # via `npm run ui -- smoke --ux-gates fail` once P00-17 lands
```

Phase close also requires every journey tagged `p00` to pass (`auto-test-suite journey --tag p00 --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- App launches on Android emulator and web into the five themed tabs with Booky in each empty state.
- Fresh database created and migrated to version 1 on first launch.
- `npm run check` and `npm run ui -- smoke --ux-gates fail` green locally and in CI.
- `maestro test .maestro/launch.yaml` passes on an emulator.
- All P00 cards ticked in `STATUS.md`.
