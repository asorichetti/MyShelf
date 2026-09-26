# Phase 00 — Foundation

## Goal

Everything later phases build on: the Expo app skeleton with routing and a web target, the design system (tokens, fonts, UI primitives), Booky, tab navigation, the SQLite data layer with the v1 schema, the three test harnesses (Jest, the auto test suite, Maestro) and CI. At the end of this phase the app launches into five themed, empty tabs on Android and web, and the regression gate runs in CI.

## Scope

- Project scaffold, Expo Router, web target, Jest, selector contract, repo and commit hook (already on `main`).
- Theme tokens and fonts; UI primitives; Booky component with expressions and bubble.
- Bottom tabs: Shelf, Scan, Loans, Groups, Settings (placeholder content with page-state markers).
- `Db` interface, `expo-sqlite` and Node adapters, migration runner, initial schema migration, domain models and base repositories.
- The auto test suite (`tools/auto-test-suite`): core, UX gates, commands and first journeys, plus follow-ups P00-21..P00-29.
- The remaining UI primitives that later phases need (P00-30).
- Maestro setup and a launch flow.
- GitHub Actions CI and linting.

## Out of scope

- Any real feature screen (Phase 01+).
- Network calls (Phase 02). Camera and OCR (Phase 03).
- Dark theme (P09-02).

## Prerequisites

- Node 22.13+ or 23.4+ (for `node:sqlite`) and npm; a one-time `npm run autotest:install-browser` (Chromium) for the auto test suite; Android Studio emulator or a device with USB debugging for Maestro; Maestro CLI installed (`curl -fsSL "https://get.maestro.mobile.dev" | bash`).
- `git config core.hooksPath .githooks` run once in the clone.

## Notes for implementers

Most of this phase is on `main`: the scaffold (P00-01…P00-07), the design system, Booky, tabs and database layer (P00-08…P00-14), the auto test suite (P00-15…P00-17), CI (P00-19) and the follow-ups P00-24…P00-26. Their cards below describe what was delivered, with the real file names; the code is the source of truth. The auto test suite was first built in Go and then ported to TypeScript ([ADR 0013](../adr/0013-typescript-auto-test-suite.md)); [`tools/auto-test-suite/README.md`](../../tools/auto-test-suite/README.md) is the reference for its flags, gates and journeys.

Still to do: Maestro (P00-18), linting (P00-20), the auto test suite follow-ups P00-21…P00-23 and P00-27…P00-29, and the remaining UI primitives (P00-30). If the code differs from a path or API named in a card here or in a later phase, update the docs in the same pull request.

Decisions made while building the foundation, all described in `PLAN.md`:

- The Shelf tab keeps the `home` test id group (`home.root`, `home.title`, …); there is no `shelf` group.
- The palette is warm paper (`paper #FBF6EC`) with role-named colours from `src/theme/tokens.ts`, and Booky is a labelled image rather than decorative ([ADR 0014](../adr/0014-warm-paper-palette-and-labelled-booky.md)).
- The schema version is tracked in a `schema_migrations` table and mirrored in `PRAGMA user_version`.
- Screens live in `src/features/<feature>/`; route files re-export them. `DatabaseProvider` lives in `src/db` (`PLAN.md` §2, layering).
- Inactive tabs are unmounted, so only one screen's `h1` and page-state marker are in the document; tabs lose local state when left (`PLAN.md` §2, Navigation).
- The web page template is `public/index.html`, because Expo Router ignores `+html.tsx` with `web.output: "single"`; the COOP/COEP headers `expo-sqlite` needs on web come from `metro.config.js` (`PLAN.md` §2, Web target).
- Expo Router's typed routes exist only once the dev server has generated them, so strict route checking happens in the auto test suite CI job (`PLAN.md` §10.5).

---

## Task cards

### P00-01 Scaffold Expo TypeScript app — done

- **Description:** Create the Expo SDK 57 app with TypeScript strict mode, `@/*` path alias to `src/*`, MIT licence, app identity (`MyShelf`, package `dev.asorichetti.myshelf`, scheme `myshelf`), adaptive icon background `#EDE4F7`.
- **Files:** `package.json`, `app.json`, `tsconfig.json`, `assets/*`, `LICENSE`, `.gitignore`.
- **Acceptance:** `npm run typecheck` passes; `npx expo start` serves the app.
- **Tests:** covered by P00-04.

### P00-02 Expo Router with routes in `src/app` — done

- **Description:** `expo-router` as entry (`"main": "expo-router/entry"`), root stack in `src/app/_layout.tsx`, placeholder home at `src/app/index.tsx` (replaced by the Shelf tab in P00-11), typed routes enabled.
- **Files:** `src/app/_layout.tsx`, `app.json` (`plugins`, `experiments.typedRoutes`).
- **Acceptance:** app opens on the home screen showing "MyShelf".
- **Tests:** originally `src/__tests__/home.test.tsx`; since P00-11, `src/__tests__/tabs.test.tsx`.

### P00-03 Web target — done

- **Description:** `react-native-web`, `react-dom`, `@expo/metro-runtime`; Metro web bundler with single-page output; scripts `web` and `export:web`.
- **Files:** `package.json`, `app.json` (`web`).
- **Acceptance:** `npm run web` renders the home screen in a browser; `npm run export:web` writes `dist/`.
- **Tests:** the `home-loads` and `home-responsive` journeys (P00-17) run against the web build.

### P00-04 Jest with jest-expo and Testing Library — done

- **Description:** `jest-expo` preset, `@testing-library/react-native`, `tools/` ignored by Jest, `npm test`.
- **Files:** `package.json` (`jest` block, setup file `src/testing/jest.setup.ts`).
- **Acceptance:** `npm test` passes.
- **Tests:** the first home screen test (now `src/__tests__/tabs.test.tsx` and `screens.test.tsx`).

### P00-05 Selector contract and generator — done

- **Description:** `src/testing/selectors.json` → `scripts/gen-selectors.mjs` → `src/testing/testids.gen.ts` (used by the app, Jest and the auto test suite); validation (camelCase keys, kebab-case unique ids); `--check` mode; `npm run check` = `selectors:check` + `typecheck` + `test --ci`.
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
- **Tests:** manual check documented in `AGENTS.md`; CI check of pushed commit messages in P00-22.

### P00-08 Design tokens and fonts — done

- **Description:** Tokens in `src/theme/tokens.ts` (`PLAN.md` §9): a raw `palette` and role colours (`lightColors`), the contrast pairs `textPairs` and `uiPairs`, spacing, sizes, radii, font families, typography and elevation. `themes.ts` builds the `Theme` (the dark scheme falls back to light until P09-02); `ThemeProvider` and `useTheme()` provide it; `contrast.ts` has the WCAG ratio helper. Lora, Nunito and Courier Prime come from `@expo-google-fonts/*`, each weight imported from its own subpath (`fonts.ts`), and load in the root layout with the splash screen held until fonts and database are ready. On web, `ThemeProvider` writes every token to `:root` as an `--ms-*` custom property (`cssVars.web.ts`; `cssVars.ts` is the native no-op) and sets the body background, colour and font; `public/index.html` is the page template (`lang`, viewport, token fallbacks, `font-synthesis: none`), because `+html.tsx` is ignored with `web.output: "single"`.
- **Files:** `src/theme/{tokens,themes,index,fonts,contrast,cssVariables,cssVars,cssVars.web,platformTypography,platformTypography.web}.ts`, `src/theme/ThemeProvider.tsx`, `src/app/_layout.tsx`, `public/index.html`.
- **Acceptance:**
  - No colour literal (hex, `rgb()`, `hsl()`) in `src/app`, `src/components` or `src/features` outside tests.
  - Every pair in `textPairs` has contrast ≥ 4.5:1 and every pair in `uiPairs` ≥ 3:1.
  - On web, `getComputedStyle(document.documentElement).getPropertyValue('--ms-color-primary')` returns `#6B3FA8`; the `render` gate's `tokens` rule checks the core tokens on every page load (P00-24).
- **Tests:** `src/theme/__tests__/theme.test.tsx` (contrast helper and every pair, CSS variable names, typography families and weights, touch-target size, provider), `src/theme/__tests__/no-hardcoded-colours.test.ts`.

### P00-09 UI primitives — done

- **Description:** Themed, accessible building blocks in `src/components/ui`: `Screen` (safe area, optional scroll, a `main` landmark carrying the screen's root id, and exactly one page-state marker via `pageState="loading" | "content" | "error"`), `Heading` (levels 1–3, `role="heading"`), `Text` (variants `body`, `bodyStrong`, `label`, `tabLabel`, `caption`, `mono`, `stamp`; colour by role), `Button` (`primary`, `secondary`, `ghost`, `danger`; loading and disabled states; 48 dp minimum height), `Card` (catalogue-card styling: header rule, optional eyebrow and title, punched hole; becomes a button when pressable), `TextField` (label, helper text, error announced as an alert, `outline` border, focus border, 48 dp), `EmptyState` (illustration slot for Booky, title at a chosen heading level, message, one action). The rest of the planned set moved to P00-30.
- **Files:** `src/components/ui/{Screen,Heading,Text,Button,Card,TextField,EmptyState}.tsx`, `src/components/ui/index.ts`.
- **Acceptance:** each component uses tokens only; touch targets ≥ 48 dp; every interactive component exposes a role and a label; `Screen` renders exactly one page-state marker.
- **Tests:** `src/components/ui/__tests__/primitives.test.tsx` — landmarks and page-state marker, heading levels, variants, disabled/loading, labels, error announcement, focus border.

### P00-10 Booky component, bubble and hook — done

- **Description:** Booky as an SVG (`react-native-svg`): a purple ribbon bookmark with a notched tail, tassel, eyes and cheeks, with `expression: 'happy' | 'thinking' | 'excited' | 'sleepy' | 'concerned'`, `size` and `animated`. Booky is a labelled image (`role="img"`, "Booky the bookmark, smiling happily"); the artwork inside is hidden from assistive tech. The idle bob is off when reduce-motion is on (`src/hooks/useReducedMotion.ts`). `BookyBubble` shows a message with optional title and actions and a dismiss button labelled "Dismiss Booky's tip" (32 dp with hit slop to 48 dp), in a polite live region. `BookyProvider` (root layout) holds the current tip; `useBooky()` returns `{ tip, showTip(tip), dismissTip() }`; `BookyTipHost` (tab layout) floats the tip above the tab bar.
- **Files:** `src/components/booky/{Booky,BookyBubble,BookyProvider}.tsx`, `expressions.ts`, `nativeDriver.ts` / `nativeDriver.web.ts`, `index.ts`; `src/hooks/useReducedMotion.ts`.
- **Acceptance:** all five expressions draw different artwork; the dismiss button has the label "Dismiss Booky's tip"; bubble text is a polite live region; the bob does not run with reduce-motion on.
- **Tests:** `src/components/booky/__tests__/booky.test.tsx` (Booky, BookyBubble, useBooky with BookyTipHost).

### P00-11 Bottom tabs and placeholder screens — done

- **Description:** Tab navigator in `src/app/(tabs)/`: Shelf (`index`), Scan, Loans, Groups, Settings. Route files re-export screens from `src/features/<feature>/`; the navigator is `src/features/navigation/TabsLayout.tsx`. Each screen is a `Screen` with an `h1` and an `EmptyState` with Booky. The Shelf keeps the existing `home` test id group (`home.root`, `home.title`) and adds the catalogue size from the database (`home.bookCount`), a Scan action (`home.scanAction`) and a "What can Booky do?" button that shows a tip (`home.askBooky`). Tab bar: `surface` background, `surfaceTint` behind the active tab, `primary` active and `inkMuted` inactive colours, icons (`MaterialCommunityIcons`) and labels, 48 dp items, safe-area aware height. Only the focused tab's screen is mounted (`PLAN.md` §2, Navigation). Adds `pageState.loading` and a loading screen shown while the database opens.
- **Files:** `src/app/(tabs)/{_layout,index,scan,loans,groups,settings}.tsx`; `src/features/navigation/{TabsLayout,LoadingScreen,DatabaseErrorScreen}.tsx`; `src/features/{shelf/ShelfScreen,scan/ScanScreen,loans/LoansScreen,groups/GroupsScreen,settings/SettingsScreen}.tsx`, `src/features/shelf/useBookCount.ts`; `src/app/_layout.tsx`; `src/testing/selectors.json`.
- **Acceptance:** every tab reachable by tap and by URL on web (`/`, `/scan`, `/loans`, `/groups`, `/settings`); the active tab is marked selected (`aria-selected="true"` on web); each screen renders one `h1` and `page-content`; `npm run autotest:check` and `npm run -s autotest:smoke` pass.
- **Tests:** `src/__tests__/tabs.test.tsx` (landing on the Shelf, each tab's route and title, one `h1` and page marker at a time, the Scan action), `src/__tests__/screens.test.tsx` (each screen's landmark, `h1`, marker and Booky), `src/features/__tests__/shellScreens.test.tsx` (loading and database-error screens).

### P00-12 `Db` interface and adapters — done

- **Description:** `Db` in `src/db/types.ts`: `exec`, `run` → `{ lastInsertRowId, changes }`, `get<T>`, `all<T>`, `transaction<T>(fn(tx))`, `close`. `createDb(connection)` (`createDb.ts`) wraps a raw adapter connection with a FIFO lock so nothing interleaves with an open transaction, and nests transactions as savepoints. Adapters: `src/db/expo.ts` (`openExpoDatabase()`, and `openAppDatabase()` for the app's single shared connection) and `src/db/node.ts` (`openNodeDatabase()` on `node:sqlite`, for Jest only). Connection pragmas in `pragmas.ts` (foreign keys on, WAL) and `pragmas.web.ts` (foreign keys only). `createTestDb()` (`src/testing/createTestDb.ts`) returns a migrated in-memory database. `DatabaseProvider` (`src/db/DatabaseProvider.tsx`) opens and migrates the database and provides it through `useDatabase()`; the root layout passes `LoadingScreen` (`page-loading`) as its fallback and `DatabaseErrorScreen` (`page-error` with a retry button) as its error view. `StaticDatabaseProvider` gives tests a ready database. On web, `expo-sqlite` runs under the Expo dev server with the COOP/COEP headers set in `metro.config.js` (and `.wasm` registered as an asset); P00-21 added the same headers to `--serve`.
- **Files:** `src/db/{types,createDb,expo,node,pragmas,pragmas.web,index}.ts`, `src/db/DatabaseProvider.tsx`, `src/testing/createTestDb.ts`, `metro.config.js`, `app.json` (`expo-router` plugin `headers`).
- **Acceptance:** the Node adapter runs real SQLite with foreign keys enforced; a failing statement inside `transaction` rolls back, and an inner failure only undoes the inner savepoint; other callers wait for an open transaction; on web the Shelf renders the catalogue size read from the database.
- **Tests:** `src/db/__tests__/createDb.test.ts`, `src/db/__tests__/DatabaseProvider.test.tsx` (both in the node environment or with the Node adapter).

### P00-13 Migration runner and initial schema — done

- **Description:** Forward-only migrations in `src/db/migrations` as TS modules exporting `{ version, name, up }` (`0001_init.ts`; `index.ts` lists them and exports `LATEST_VERSION`). `migrate(db)` (`src/db/migrate.ts`) creates `schema_migrations` (`version`, `name`, `applied_at`), applies each pending migration in its own transaction together with its `schema_migrations` row and `PRAGMA user_version`, rejects out-of-order lists, and refuses a database newer than the app. `0001_init` creates every table in `PLAN.md` §5 with foreign keys, `ON DELETE` rules, `CHECK` constraints, `genres.name UNIQUE COLLATE NOCASE`, the `loans_one_open_per_book` partial unique index and indexes on titles, ISBNs, series order, source, author names, the link tables' reverse keys, loans by book, borrower and open due date.
- **Files:** `src/db/migrations/{index,types,0001_init}.ts`, `src/db/migrate.ts`.
- **Acceptance:** a fresh database ends at version 1 (in `schema_migrations` and `user_version`); running `migrate` twice is a no-op, also across reopening a database file; a failing migration leaves the last good version; inserting a second open loan for a book fails; deleting a book cascades.
- **Tests:** `src/db/__tests__/migrate.test.ts` (runner, and "schema 001": partial index, indexes, checks, foreign keys); cascades in `src/db/__tests__/repositories.test.ts`.

### P00-14 Domain models and base repositories — done

- **Description:** Domain types in `src/domain` (`Book`, `NewBook`, `BookPatch`, `BookGroup`, `Author`, `BookAuthor`, `Genre`, `BookGenre`, `Series`, `Group`, `Borrower`, `Loan`, `LoanWithDetails`, `NewLoan`, `AppSettings` with `settingDefaults`) and pure helpers: `isbn.ts` (`normalizeIsbn`, `isValidIsbn10`/`13`, `isbn10To13`, `isbn13To10`), `dates.ts` (local `YYYY-MM-DD` `today`, `addDays`, `compareDates`, `daysBetween`, parsing), `author.ts` (`toSortName("Terry Pratchett")` → `"Pratchett, Terry"`, with particles and suffixes), `loan.ts` (`isOverdue`). Repositories in `src/db/repositories`, exported from `@/db` as namespaces: `booksRepo`, `authorsRepo`, `genresRepo`, `seriesRepo`, `groupsRepo`, `loansRepo` (borrowers and loans) and `settingsRepo` (typed keys, JSON values, defaults). Every function takes the `Db` first (`booksRepo.createBook(db, input)`); row ↔ domain mapping stays in the repository. Beyond CRUD they already include `searchBooks`, `countBooks` and the group-by queries (`groupBooksByGenre`, `…BySeries`, `…ByAuthor`, `…ByGroup`).
- **Files:** `src/domain/*.ts`, `src/db/repositories/*.ts`.
- **Acceptance:** each repository round-trips its entity; `loansRepo.lendBook` on a book with an open loan throws `BookAlreadyOnLoanError`; deleting a borrower with loans throws `BorrowerHasLoansError`; settings return defaults when unset or unreadable.
- **Tests:** `src/domain/__tests__/{isbn,dates,authors}.test.ts`; `src/db/__tests__/repositories.test.ts`.

### P00-15 Auto test suite core — done

- **Description:** Command-line tool in `tools/auto-test-suite/src/`, TypeScript with the Playwright library and Commander, run with `tsx` through the `autotest` package script (no build step). Global flags: `--env` (`local` = `http://localhost:8081`), `--base-url` (overrides `--env`), `--headless` (default true when `CI` is set or there is no display; false on macOS), `--screenshot-dir` (default `./screenshots`), `--ux-gates off|warn|fail` (default `warn`), `--viewport mobile|tablet|desktop` (390×844, 820×1180, 1280×900; default `mobile`), `--color-scheme light|dark|no-preference`, `--gates-config`, `--console-allowlist`. The browser module launches a **fresh browser, context and page per run**, attaches console and network listeners before navigating, and writes an evidence bundle per command or journey to `<screenshot-dir>/<command>-<unixMillis>/`: `screenshot.png`, `page.html` (rendered DOM), `console.json`, `network.json` (failed traffic only) and `uxgates.json`. The bundle is written even when the run fails, including a placeholder bundle when the browser does not start, so failed runs always leave evidence. stdout is exactly one JSON document per invocation, including usage errors; progress goes to stderr; exit code 1 on failure. Package scripts `autotest` (passthrough: `npm run -s autotest -- <command> [flags]`), `autotest:install-browser` and `autotest:check` (typecheck + unit tests with Node's test runner); `screenshots/` is git-ignored.
- **Files:** `tools/auto-test-suite/src/cli.ts`, `tools/auto-test-suite/src/browser/`, `tools/auto-test-suite/README.md`; `package.json`; `.gitignore`.
- **Acceptance:**
  - `npm run autotest:check` passes.
  - `npm run -s autotest -- --help` lists the global flags above; an unknown `--viewport`, `--env` or `--ux-gates` value prints `{"command":…,"ok":false,"error":…}` on stdout and exits 1.
  - Every browser run creates a new timestamped run directory holding the five bundle files.
- **Tests:** unit tests for base URL resolution, URL joining and the render viewports (both ends of the width range), run by `npm run autotest:check`.

### P00-16 Auto test suite UX gates — done

- **Description:** A `uxgates` module with five gates that run alongside assertions and record every result, finding and piece of evidence in `uxgates.json`. Per page load it runs `pagestate` (content marker visible within 15 s, no visible `pageState.error`, at least 10 characters of text in the visible `main`), then `render` at the selected viewport and the other end of the width range (rules `stylesheets`, `tokens`, `body-margin`, `body-background`, `body-font`, `text-font`, `fonts-loaded`, `fonts-error`, `images`, `overflow`, `landmarks`, checked through computed styles after `document.fonts.ready`), then `a11y` (rules `one-h1`, `heading-order`, `img-alt`, `accessible-name`, `skip-link`, `one-main`, `nav-labels`, `html-lang`; hidden and `aria-hidden` subtrees ignored). A failed `pagestate` skips `render` and `a11y` for that page. `console` (errors and uncaught exceptions not in the allowlist) and `network` (responses ≥ 400 and requests with no response) run at the end of the command or journey. Modes `off`/`warn`/`fail`; only `fail` turns findings into a failed run. Configuration: `gates.config.json` (`render.requiredTokens`, `render.landmarks`, and `disabled` maps where every rule needs a reason; unknown rule ids are rejected at startup) and `console_allowlist.json` (pattern + reason, both required; currently empty). Per-journey waivers (gate, rule, reason) downgrade a finding to a recorded warning. The expected-missing marker `__expected-404` exempts deliberately missing URLs from the console and network gates. Decisions at delivery: `a11y/skip-link` off (mobile app, no repeated block to skip); `render/landmarks` requires `main` only; `render/requiredTokens` empty and `render/body-background`, `render/body-font`, `render/fonts-loaded` off temporarily until the theme and app shell landed. P00-24 has since filled `requiredTokens` and re-enabled those three rules.
- **Files:** `tools/auto-test-suite/src/uxgates/` (one module per gate, plus config, `gates.config.json`, `console_allowlist.json`).
- **Acceptance:**
  - Config with an unknown rule id or a disabled rule without a reason, and an allowlist entry without a reason, are rejected.
  - A waived finding stays in `uxgates.json` as a warning with the reason and the waiver listed.
  - Every gate fires against a temporary broken route (procedure in the tool README, "Proving the gates fire"; last run: all five gates and the rules `images`, `overflow`, `text-font`, `one-h1`, `heading-order`, `img-alt`, `accessible-name`, `nav-labels`, `content-marker`, `http-status`, `request-failed` reported, and `--ux-gates fail` exited 1). Automating that proof is P00-28.
  - `smoke` passes with `--ux-gates fail` against the current app.
- **Tests:** unit tests for mode parsing, fail-mode errors, warn severity, config and allowlist validation, the expected-missing marker and waivers, run by `npm run autotest:check`.

### P00-17 Auto test suite commands, journeys and package scripts — done

- **Description:** Commands `navigate --url <path> [--wait <ms>] [--marker <selector>]`; `journey <name…> | --all | --suite <suite> | --grep <regexp>`, with `--list` to print the (selected) registry; `smoke` (`journey --suite core` with `--ux-gates fail` and headless unless passed explicitly); `screenshot --url <path> --viewports <list> --schemes <list>` (one browser and bundle per combination); `interact click|fill|press|focus --url <path> (--testid <id> | --selector <sel>) [--value] [--key] [--settle]`, which reports the focused element and its ARIA state. Self-registering journey registry in `tools/auto-test-suite/src/journeys/` (one file per area; unique names, sorted, duplicates rejected), each journey with a name, suite, description and `run` function that gets the Playwright page and helpers for gated navigation, a custom content marker, extra screenshots and per-journey waivers. Journeys build selectors from `Testids` in `src/testing/testids.gen.ts`. Assertion messages say what was expected and what was found. First journeys: `home-loads` (core), `not-found` (core; uses the expected-missing marker, and at delivery waived `a11y/one-main` and `render/landmarks` for Expo Router's built-in screen, until P00-26 replaced it), `home-responsive` (responsive). Package scripts `autotest:smoke` (`smoke`) and `autotest:journeys` (`journey --all`).
- **Files:** `tools/auto-test-suite/src/commands/`, `tools/auto-test-suite/src/journeys/`; `package.json`.
- **Acceptance:**
  - `npm run -s autotest -- journey --list` prints JSON listing every journey with its suite (at delivery `home-loads`, `home-responsive` and `not-found`; P00-25 added `tabs-navigate`).
  - With the web server running (`CI=1 npx expo start --web --port 8081`), `npm run -s autotest:smoke` and `npm run -s autotest:journeys -- --ux-gates fail` pass (today 3/3 and 4/4).
- **Tests:** unit tests for the registry (sorted, `core` suite non-empty, duplicate names rejected) and the assertion message format; the journeys themselves.

### P00-18 Maestro setup

- **Description:** `.maestro/config.yaml`, a shared `appId: dev.asorichetti.myshelf`, and a `launch.yaml` flow that launches the app, asserts each tab by id and taps through them. Document how to run on an emulator in `.maestro/README.md` (development build from P03-01; until then, a local `npx expo run:android` build).
- **Files:** `.maestro/config.yaml`, `.maestro/launch.yaml`, `.maestro/README.md`.
- **Acceptance:** `maestro test .maestro/launch.yaml` passes on an Android emulator.
- **Tests:** the flow itself.

### P00-19 GitHub Actions CI — done

- **Description:** `.github/workflows/ci.yml` on push to `main` and on every pull request, with read-only permissions and one run per ref (older runs cancelled). Job **App checks**: Node with npm cache, `npm ci`, `npm run check`. Job **auto-test-suite** (smoke): `npm ci`, `npm run autotest:check`, install Chromium with its system dependencies, start the Expo web server on 8081 (`CI=1 npx expo start --web`) and wait for it, run `npm run typecheck` again now that the server has generated the typed routes (step "Typecheck with generated route types"; see `PLAN.md` §10.5), run `smoke` and the `responsive` suite with `--ux-gates fail --headless=true`, and on failure upload `screenshots/` plus the Expo log as the `auto-test-suite-screenshots` artifact (14-day retention).
- **Files:** `.github/workflows/ci.yml`.
- **Acceptance:** both jobs run on every push to `main` and every pull request, and both passed on `main`; a gate failure or failing journey makes the command exit 1, which fails the step and triggers the evidence upload; the same steps pass locally (`npm run check`, `npm run autotest:check`, `npm run -s autotest:smoke`).
- **Tests:** CI itself. Follow-ups: checking pushed commit messages (P00-22), running every journey rather than named suites (P00-23), and running against the exported build with `--serve` (P00-21).

### P00-20 Linting — done

- **Delivered:** `eslint.config.js` extends `eslint-config-expo/flat` (TypeScript, React, `react-hooks` including the React Compiler rules) and adds `import/order` (builtin/external, then the `@/` alias, then relative, blank line between groups, alphabetised) and `react-hooks/exhaustive-deps` as errors. `npm run lint` runs `eslint .` over the app and `tools/`; `npm run check` runs it after `selectors:check`. Adopting it fixed two real hook issues: `Booky` read a ref during render (now `useState` for the animated value) and `DatabaseProvider` set state synchronously inside an effect (the reset moved to the retry handler).
- **Not adopted:** a lint rule for raw colour literals. `src/theme/__tests__/no-hardcoded-colours.test.ts` keeps enforcing that. No Prettier: the Expo config has no formatting rules that would conflict with it, so it can be added later without churn.
- **Files:** `eslint.config.js`, `package.json`.
- **Acceptance (met):** `npm run lint` clean; `npm run check` runs lint.
- **Tests:** CI app job (via `npm run check`).

### P00-21 `--serve <dir>` for the exported web build — done

- **Delivered:** `tools/auto-test-suite/src/server/static.ts` (on `node:http`) and the global `--serve <dir>` flag: serves the export on a free `127.0.0.1` port for the run, SPA fallback for extension-less paths, real 404s for missing files, COOP `same-origin` + COEP `credentialless` on every response, `.wasm` as `application/wasm`, traversal refused, `no-store`; `--serve` with `--base-url` or an explicit `--env` is a usage error. Under `--serve dist` the page is `crossOriginIsolated`, expo-sqlite opens (the Shelf shows "0 books catalogued") and the console is clean; all journeys pass with `--ux-gates fail`. CI now exports and runs the journeys with `--serve dist`. `expo export` does not write Expo Router's typed routes, so CI starts the dev server only until `.expo/types/router.d.ts` exists, stops it and then runs the strict typecheck. Timings (local, cold caches, four journeys): dev server 1.2 s + 5.7 s, export 4.5 s + 2.9 s; the export was chosen for fidelity (shipped bundle, real 404s, no lazy bundling in the first journey), not speed.
- **Description:** Global flag `--serve <dir>`: start an in-process static file server on a free local port for a static export (e.g. `dist` from `npm run export:web`), use it as the base URL, and stop it when the command ends. Unknown paths without a file extension fall back to `index.html` (SPA routing); missing assets return a real 404 (unlike the dev server, which answers every path with the HTML shell). Every response carries `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` (the values P00-12 settled on and `metro.config.js` sends) so the `expo-sqlite` web build has `SharedArrayBuffer`. `--serve` and `--base-url` are mutually exclusive. Then switch the CI smoke job to `npm run export:web` + `--serve dist`, which is faster and closer to the shipped bundle than the dev server.
- **Files:** `tools/auto-test-suite/src/server/` (new, on `node:http`), `tools/auto-test-suite/src/cli.ts`, `README.md`; `.github/workflows/ci.yml`.
- **Acceptance:** `npm run -s autotest -- smoke --serve dist` passes after `npm run export:web`; the page reports `crossOriginIsolated === true`; a missing asset shows up in `network.json` as a 404.
- **Tests:** unit tests against the server on an ephemeral port: SPA fallback, real 404 for missing assets, isolation headers, path traversal rejected.

### P00-22 CI check of commit messages — done

- **Delivered:** CI job **Commit messages** (full-history checkout) runs `scripts/check-commit-messages.sh <base> <head>`, which passes every commit message in the range to `.githooks/commit-msg` and reports each rejected commit by short hash and subject as a GitHub error annotation. Pull requests check base..head of the PR (not GitHub's merge commit); pushes check `before`..`after`. When `before` is all zeros (first push of a branch) it checks the commits since the default branch, or the whole history when the branch is the default branch; on a force push it tries to fetch the old tip and checks the commits since the merge base, falling back the same way. Every scenario (clean range, rejected commit, first push, force push with known and unknown old tip) was run locally in a throwaway clone; the whole existing history passes the hook. Not yet proven on GitHub itself.
- **Description:** A CI step (in the App checks job, or a small job of its own) that runs `.githooks/commit-msg` against every commit message in the pushed range or pull request (`git log --format=%B` per commit from the base to `HEAD`, each written to a temp file and passed to the hook), so a commit made without the hook enabled is still caught. Needs a checkout with enough history (`fetch-depth: 0`).
- **Files:** `.github/workflows/ci.yml`.
- **Acceptance:** a pull request containing a commit whose message the hook rejects fails CI and names the commit; normal pull requests pass.
- **Tests:** CI itself, proven once on a throwaway branch.

### P00-23 CI runs every journey

- **Description:** Replace the CI step that runs `journey --suite responsive` with `npm run -s autotest -- journey --all --ux-gates fail --headless=true` (or `smoke` followed by every non-core suite discovered from `journey --list`), so journeys in new suites (`p00`, `p01`, …) are covered without editing the workflow each time. Keep `smoke` as its own step so a core failure is reported first.
- **Files:** `.github/workflows/ci.yml`.
- **Acceptance:** a journey registered in a new suite runs in CI without a workflow change; the evidence artifact still uploads on failure.
- **Tests:** CI itself.

### P00-24 Re-enable the temporary render rules and require the design tokens — done

- **Description:** After P00-08 (tokens on `:root`) and the app shell styling of `<html>`/`<body>` on web: list the core `--ms-*` custom properties the app relies on in `render.requiredTokens` (`--ms-color-primary`, `--ms-color-paper`, `--ms-color-surface`, `--ms-color-ink`, `--ms-color-ink-muted`, `--ms-font-heading`, `--ms-font-body`, `--ms-space-md`, `--ms-radius-md`), and delete the three **temporary** `disabled` entries (`body-background`, `body-font`, `fonts-loaded`) in `gates.config.json`, fixing whatever they then report. `fonts-loaded` applies now that Lora, Nunito and Courier Prime load through `expo-font`. The `theme-tokens` journey planned here moved to P00-29.
- **Files:** `tools/auto-test-suite/src/uxgates/gates.config.json`, `tools/auto-test-suite/README.md` (decisions table); app shell files (`public/index.html`, `src/theme/cssVars.web.ts`).
- **Acceptance:** `gates.config.json` disables only `a11y/skip-link`; `npm run -s autotest:journeys -- --ux-gates fail` passes; a required token missing from `:root` makes the `render/tokens` rule fail (checked with a `--gates-config` that requires a token the app does not define).
- **Tests:** the existing journeys under the stricter config.

### P00-25 Tab journeys — done

- **Description:** Once P00-10 and P00-11 landed, add the `tabs-navigate` journey (see the table below) in the `core` suite, using `Testids.tabs.*` and each tab's `root` and `title` ids (`home.*` for the Shelf). For each tab it clicks the tab, waits for the screen, checks the URL (`/scan`, `/loans`, `/groups`, `/settings`, then back to `/`), exactly one visible `h1` with the expected text, that only the active tab has `aria-selected="true"` (the web tab bar sets no `aria-current`), runs the page gates and saves a screenshot. It also checks that Booky is visible in the empty Shelf, found by its image role and label. The separate `booky-empty-shelf` journey planned here moved to P00-29.
- **Files:** `tools/auto-test-suite/src/journeys/tabs.journey.ts`.
- **Acceptance:** `npm run -s autotest -- journey --list` shows `tabs-navigate` in `core`; `npm run -s autotest:smoke` runs and passes it.
- **Tests:** the journey itself.

### P00-26 App-owned not-found screen — done

- **Description:** Replace Expo Router's built-in unmatched-route screen with `src/app/+not-found.tsx`, which re-exports `NotFoundScreen` (`src/features/navigation/NotFoundScreen.tsx`), built from the UI primitives: a `Screen` with a `main` landmark, an `EmptyState` whose title is the one `h1` ("Page not found"), Booky (*concerned*) and a "Back to my shelf" button that returns to `/`. Its test ids are the `notFound` group; the `not-found` journey uses them and has no waivers.
- **Files:** `src/app/+not-found.tsx`, `src/features/navigation/NotFoundScreen.tsx`, `src/testing/selectors.json` (+ generated file), `tools/auto-test-suite/src/journeys/not-found.journey.ts`.
- **Acceptance:** `not-found` passes with `--ux-gates fail` and no waivers in its `uxgates.json`; the button returns to `/`.
- **Tests:** `src/__tests__/tabs.test.tsx` (unknown URL renders the screen and links home), `src/__tests__/screens.test.tsx` (landmark, `h1`, concerned Booky); the `not-found` journey.

### P00-27 Touch-target rule in the a11y gate

- **Description:** Add an a11y rule `target-size`: every visible, enabled interactive element (button, link, tab, menuitem, switch, checkbox, and elements with those roles) must have a hit area of at least 48 × 48 CSS px (the plan's 48 dp minimum), measured from its bounding box; inline links inside running text are exempt. Findings name the element and its size. Register the rule id with the other a11y rule ids so it can be disabled only with a reason.
- **Files:** the a11y gate and config modules in `tools/auto-test-suite/src/uxgates/`, `tools/auto-test-suite/README.md`.
- **Acceptance:** a temporary 30 × 30 px button is reported; all journeys still pass with `--ux-gates fail` (fix the app where they do not).
- **Tests:** covered by the gate self-tests in P00-28; until then, proven with a temporary route as in the tool README.

### P00-28 Automated gate self-tests

- **Description:** Automate the README procedure "Proving the gates fire": a test (Node's test runner) that serves small HTML fixtures from a local `node:http` server (one clean page, and one page per rule that breaks exactly that rule), loads each in Chromium and asserts which gate and rule report a finding. Skipped with a clear message when Chromium is not installed, and run in the CI auto-test-suite job after the browser install.
- **Files:** a self-test module and HTML fixtures under `tools/auto-test-suite/src/uxgates/`; `.github/workflows/ci.yml`.
- **Acceptance:** every render and a11y rule id, plus the pagestate, console and network checks, has a fixture that makes it fire; the clean fixture passes every gate; removing a rule's check makes the test fail.
- **Tests:** the test itself.

### P00-29 Booky and theme journeys

- **Description:** The two journeys split out of P00-24 and P00-25. Give the empty-shelf Booky the `booky.avatar` test id. `booky-empty-shelf` (`core`): open `/`; expect `booky.avatar` inside `emptyState.root`; tap `home.askBooky`; expect `booky.bubble` with non-empty `booky.bubbleText`, the page gates clean with the bubble open; tap `booky.dismiss` and expect the bubble gone. `theme-tokens` (`p00`): open `/`; `--ms-color-primary` on `:root` is `#6B3FA8`; the computed body background equals `--ms-color-paper` and the body font starts with `--ms-font-body`.
- **Files:** `src/features/shelf/ShelfScreen.tsx`; new journey files in `tools/auto-test-suite/src/journeys/`.
- **Acceptance:** `npm run -s autotest -- journey --list` shows `booky-empty-shelf` in `core` and `theme-tokens` in `p00`; both pass with `--ux-gates fail`; CI runs `theme-tokens` (via P00-23, or an extra step until then).
- **Tests:** the journeys themselves.

### P00-30 Remaining UI primitives

- **Description:** The primitives from the original P00-09 list that are not built yet, needed from Phase 01: `IconButton` (icon only, required `accessibilityLabel`, 48 dp target), `CatalogueCard` (builds on `Card`: faint ruled lines, cover slot, title in Lora, authors and ISBN in Courier Prime), `Chip` (selectable and removable, for authors, genres and filters), `Stamp` (rotated rubber-stamp label in the `stamp` type style with `tone: 'warn' | 'danger' | 'success' | 'accent'`), `ConfirmDialog` (title, message, confirm and cancel, destructive variant, focus trapped while open) and `Snackbar` (message with an optional action such as Undo, auto-hide, announced politely). Add the `dialog` and `snackbar` test id groups (below).
- **Files:** `src/components/ui/{IconButton,CatalogueCard,Chip,Stamp,ConfirmDialog,Snackbar}.tsx`, `src/components/ui/index.ts`, `src/testing/selectors.json` (+ generated file).
- **Acceptance:** tokens only; touch targets ≥ 48 dp; every interactive part has a role and a label; `Stamp` text meets contrast in every tone; the dialog returns focus to its trigger when closed.
- **Tests:** `src/components/ui/__tests__/*.test.tsx` — variants, labels, disabled states, dialog confirm/cancel, snackbar action and timeout.

---

## Test ids in `selectors.json`

Delivered in this phase (the file is the source of truth):

```json
{
  "pageState": { "content": "page-content", "error": "page-error", "loading": "page-loading" },
  "home": {
    "root": "home-root", "title": "home-title", "bookCount": "home-book-count",
    "scanAction": "home-scan-action", "askBooky": "home-ask-booky"
  },
  "tabs": {
    "shelf": "tab-shelf", "scan": "tab-scan", "loans": "tab-loans",
    "groups": "tab-groups", "settings": "tab-settings"
  },
  "scan": { "root": "scan-root", "title": "scan-title" },
  "loans": { "root": "loans-root", "title": "loans-title" },
  "groups": { "root": "groups-root", "title": "groups-title" },
  "settings": { "root": "settings-root", "title": "settings-title" },
  "notFound": { "root": "not-found-root", "title": "not-found-title", "homeLink": "not-found-home-link" },
  "loading": { "root": "loading-root", "title": "loading-title" },
  "dbError": { "root": "db-error-root", "title": "db-error-title", "retry": "db-error-retry" },
  "emptyState": { "root": "empty-state", "action": "empty-state-action" },
  "booky": {
    "avatar": "booky-avatar", "bubble": "booky-bubble", "bubbleText": "booky-bubble-text",
    "dismiss": "booky-dismiss", "action": "booky-action", "tipHost": "booky-tip-host"
  }
}
```

The `home` group belongs to the Shelf tab (`/`); later phases extend it rather than adding a `shelf` group.

To add in P00-30:

```json
{
  "dialog": { "root": "dialog-root", "confirm": "dialog-confirm", "cancel": "dialog-cancel" },
  "snackbar": { "root": "snackbar-root", "action": "snackbar-action" }
}
```

## Auto test suite journeys

Run one with `npm run -s autotest -- journey <name>`, or all at once with `npm run -s autotest:journeys -- --ux-gates fail`.

| Journey | Suite | Checks | Card |
|---|---|---|---|
| `home-loads` | `core` | `/`: `home.title` is an `h1` "MyShelf" inside the single `main`, font-weight 700, not the default serif; document title "MyShelf" | P00-17 (done) |
| `not-found` | `core` | `/missing-shelf__expected-404` renders the app's not-found screen: `notFound.title` is the `h1` "Page not found" inside `main`, and the URL does not change; no waivers | P00-17, P00-26 (done) |
| `home-responsive` | `responsive` | viewport meta `width=device-width, initial-scale=1`; at mobile, tablet and desktop the title is fully on screen and nothing scrolls sideways; one screenshot per width | P00-17 (done) |
| `tabs-navigate` | `core` | open `/`; Booky visible in the empty Shelf; for each tab: click `tabs.<tab>`, expect its `root`, its URL, exactly one visible `h1` and `aria-selected="true"` on that tab only; page gates; a screenshot per tab | P00-25 (done) |
| `booky-empty-shelf` | `core` | open `/`; `booky.avatar` in `emptyState.root`; `home.askBooky` opens `booky.bubble`; `booky.dismiss` closes it | P00-29 |
| `theme-tokens` | `p00` | open `/`; `--ms-color-primary` resolves to `#6B3FA8` on `:root`; body background and font come from the tokens | P00-29 |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/launch.yaml` | app launches, splash dismissed, each tab reachable by tap, Android back from a tab exits to launcher from Shelf |

## Risks

| Risk | Mitigation |
|---|---|
| `expo-sqlite` web build needs cross-origin isolation (SharedArrayBuffer) | dev server headers from `metro.config.js` (P00-12, working); `--serve` sends them for the exported build (P00-21, working); fallback web adapter behind `Db` |
| Cross-origin isolation blocks remote cover images on web | `Cross-Origin-Embedder-Policy: credentialless` (chosen in P00-12; Chromium supports it) or serve fixture covers locally in tests |
| `node:sqlite` API differences between Node versions | pin the Node version in CI; `better-sqlite3` fallback |
| Fonts not loaded before first render → layout shift in screenshots | the root layout renders nothing until fonts load (splash held on native); `pagestate` waits for `page-content`; the `fonts-loaded` render rule is on |
| react-native-web or framework markup trips a gate rule the app cannot fix | a per-journey waiver or a `disabled` entry in `gates.config.json`, each with a written reason and recorded in `uxgates.json`; console errors only via the reviewed allowlist (pattern + reason) |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI (the web server must be running: `CI=1 npx expo start --web --port 8081`):

```bash
npm run check                    # selectors:check + lint + typecheck + Jest
npm run -s autotest:smoke        # the auto test suite's `smoke`: core journeys, gates set to fail
```

Phase close also requires every journey to pass with gates enforced (`npm run -s autotest:journeys -- --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- App launches on Android emulator and web into the five themed tabs with Booky in each empty state.
- Fresh database created and migrated to version 1 on first launch.
- `npm run check`, `npm run -s autotest:smoke` and `npm run -s autotest:journeys -- --ux-gates fail` green locally and in CI.
- `maestro test .maestro/launch.yaml` passes on an emulator.
- All P00 cards ticked in `STATUS.md`.
