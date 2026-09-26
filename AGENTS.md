# Contributing to MyShelf

This guide is for everyone who works on MyShelf — people and automated coding agents alike. MyShelf is an Expo / React Native app written in TypeScript, Android-first, with a web build used for automated UI testing. Prioritise mobile-first patterns, accessibility and cross-platform compatibility.

## 1. How to pick up work

1. **Read [`PLAN.md`](PLAN.md)** — architecture, data model, APIs, design tokens, testing strategy, definition of done.
2. **Read [`STATUS.md`](STATUS.md)** — find the first unticked card in the earliest unfinished phase whose prerequisites are met. Cards within a phase can run in parallel when they touch different files.
3. **Read the phase document** in [`docs/plan/`](docs/plan/) for that card: description, files to touch, acceptance criteria, tests, test ids, journeys and Maestro flows.
4. Check [`docs/adr/`](docs/adr/) before changing anything architectural. To change a decision, add a new ADR that supersedes the old one.
5. Work on a branch named after the card (e.g. `p01-03-shelf-screen`). Keep the change to the card's scope.
6. Finish with the **regression gate** (§4), tick the card in `STATUS.md`, and update any doc your change made stale — all in the same pull request.

If the code on `main` disagrees with a plan document (a path, a function name), the code wins: follow it and fix the document in your pull request.

## 2. Commands

Use `npx`, not `bunx` (this project uses npm; there is no `bun.lock`).

| Command | What it does | Status |
|---|---|---|
| `npm install` | install dependencies | available |
| `npx expo install <package>` | **always** use this to add a dependency — it resolves the SDK-compatible version | available |
| `npm start` / `npx expo start` | Metro dev server | available |
| `npm run android` | open on a connected device/emulator | available |
| `npm run web` | run the web build (http://localhost:8081); for the auto test suite use `CI=1 npx expo start --web --port 8081` (no file watcher; restart after adding a route) | available |
| `npm run export:web` | static web build into `dist/`; test it with any auto test suite command plus `--serve dist` (no dev server needed) | available |
| `npm run typecheck` | `tsc --noEmit`; route strings (`href`, `router.navigate`) are checked strictly only while `.expo/types/router.d.ts` exists, which only the dev server generates, so CI starts it briefly in the auto test suite job and runs the typecheck again | available |
| `npm test` | Jest | available |
| `npm run selectors:gen` | regenerate test ids from `src/testing/selectors.json` | available |
| `npm run selectors:check` | fail if the generated test id file is stale | available |
| `npm run licences:gen` | regenerate `src/generated/licences.json` (every production package and its licence, for the About screen) from `package-lock.json`; run after adding a dependency | available |
| `npm run licences:check` | fail if `licences.json` is stale | available |
| `npm run check` | `selectors:check` + `licences:check` + `lint` + `typecheck` + `test --ci` | available |
| `npm run lint` | ESLint (Expo config + import order + hooks rules) | available |
| `npm run autotest:install-browser` | one time: Chromium for the auto test suite | available |
| `npm run -s autotest -- <command> [flags]` | run any auto test suite command (`navigate`, `journey`, `smoke`, `screenshot`, `interact`); see [its README](tools/auto-test-suite/README.md) | available |
| `npm run -s autotest:smoke` | `smoke`: core journeys, gates set to fail; needs the web server on 8081 | available |
| `npm run -s autotest:journeys` | every journey (`journey --all`); add flags after `--`, e.g. `-- --ux-gates fail` | available |
| `npm run autotest:check` | typecheck and unit tests for the auto test suite | available |
| `npm run autotest:selftest` | gate self-tests: every UX gate rule fires on a broken fixture page, in Chromium (no app server needed) | available |
| `maestro test .maestro/` | on-device flows | to be added in P00-18 |
| `npx expo run:android` | local development build (needed from Phase 03 for ML Kit) | works now; dev client added in P03-01 |
| `npx expo-doctor` | diagnose dependency/config issues | available |
| `npx expo install --fix` | fix incompatible package versions | available |

## 3. Conventions

### Structure

- **Routes only in `src/app/`** (Expo Router: every file is a route; `_layout.tsx` defines navigators). Route files are one-line re-exports of a screen from `src/features` (e.g. `src/app/(tabs)/index.tsx` exports `ShelfScreen`); keep components, hooks and logic out of `src/app/`.
- `src/components/ui` — themed primitives; `src/components/booky` — Booky; `src/components/<feature>` — feature components.
- `src/features/<feature>` — screens (`ShelfScreen.tsx`) and the hooks that connect them to repositories/services (`useBookCount.ts`); `src/features/navigation` holds the tab layout and the loading, database-error and not-found screens.
- `src/hooks` — small shared hooks with no feature of their own (`useReducedMotion`).
- `src/services` — network, recognition, backup (no React, no SQL; created in Phase 02).
- `src/domain` — pure TypeScript models and helpers (no React, no Expo imports).
- `src/db` — `Db` interface, adapters (`expo.ts`, `node.ts`), migrations, repositories, and `DatabaseProvider.tsx` (opens and migrates the database, then provides it through `useDatabase()`). **No SQL anywhere else.**
- `src/theme` — design tokens. **No colour, font or spacing literals anywhere else** (a Jest test fails on colour literals outside `src/theme`).
- `src/testing` — `selectors.json`, the generated `testids.gen.ts`, `createTestDb()` and render helpers for Jest.
- Platform differences go in `*.web.ts` (or `*.native.ts`) files next to the default module, not scattered `Platform.OS` checks (e.g. `src/theme/cssVars.web.ts`, `src/db/pragmas.web.ts`).
- The web page template is `public/index.html`: with `web.output: "single"` Expo Router ignores `src/app/+html.tsx`. The dev server sends the cross-origin isolation headers `expo-sqlite` needs on web from `metro.config.js`.
- Import with the `@/` alias (`@/db/…`), not long relative paths.

### Naming

- Components `PascalCase.tsx`; hooks `useThing.ts`; other modules `camelCase.ts`; tests `*.test.ts(x)` next to the code or in a sibling `__tests__/`.
- Database tables and columns `snake_case`; domain types `camelCase` fields; mapping happens in the repository.
- Migrations are numbered `NNNN_description` and are **never edited once merged** — add a new one.
- British English in user-facing copy (colour, catalogue), matching the design.

### Test ids

- Test ids are defined **only** in `src/testing/selectors.json` (groups and keys camelCase, ids kebab-case, globally unique). Run `npm run selectors:gen` and commit the generated `src/testing/testids.gen.ts`.
- In app code, Jest and auto test suite journeys use `Testids.group.key` from `src/testing/testids.gen.ts` (`@/testing/testids.gen` in the app); in Maestro use the id string from `selectors.json`.
- Never type a raw test id string anywhere else.
- Every screen renders exactly one page-state marker (`pageState.loading`, `pageState.content` or `pageState.error`).

### Dependencies

- Add packages with `npx expo install <package>` so versions match Expo SDK 57. Prefer Expo modules over third-party libraries.
- Libraries with native code (for example ML Kit OCR) need a development build (`npx expo run:android` or `eas build --profile development`); they do not run in Expo Go.
- `android/` and `ios/` are generated (Continuous Native Generation) and git-ignored. Never create or edit them by hand — configure native behaviour through `app.json` and config plugins.

### Accessibility and UX

- Every interactive element has a role and an accessible name; touch targets ≥ 48 dp; text contrast meets WCAG AA using theme tokens; nothing is conveyed by colour alone; animations respect reduce-motion.
- Booky's copy is short, warm and never blames the user (see `PLAN.md` §8).

## 4. Testing and the regression gate

Every card lists the tests it adds. Three levels (details in `PLAN.md` §10):

- **Jest** for every module. Repository tests use `@jest-environment node` and a real in-memory SQLite database. Network is always mocked with recorded fixtures.
- **Auto test suite** (`tools/auto-test-suite`, TypeScript + Playwright; reference in [its README](tools/auto-test-suite/README.md)) drives the web build: `navigate`, `journey`, `smoke`, `screenshot`, `interact`. Each command prints one JSON document and writes an evidence bundle (`screenshot.png`, `page.html`, `console.json`, `network.json`, `uxgates.json`) under `screenshots/` (git-ignored). UX gates (`pagestate`, `render`, `console`, `network`, `a11y`) run alongside assertions; exemptions need a written reason (`gates.config.json`, the console allowlist, or a per-journey waiver). Journeys self-register in `tools/auto-test-suite/src/journeys/` with a name, suite and description, and run in a fresh browser each; from P01-01 they start from a fixture via `/e2e?fixture=<name>&next=<route>`.
- **Maestro** flows in `.maestro/` for camera, OCR and other native-only behaviour, run on an emulator or device (the folder is added in P00-18).

Before a card is done, both must be green:

```bash
npm run check
npm run -s autotest:smoke         # needs CI=1 npx expo start --web --port 8081 running
```

Before closing a phase, also run every journey with gates enforced: `npm run -s autotest:journeys -- --ux-gates fail`.

Verify behaviour by running it — tests, the web app, a device — rather than assuming it works. Look at the screenshots in the evidence bundle for any UI change.

## 5. Commits and pull requests

- **Enable the hook once per clone:** `git config core.hooksPath .githooks`.
- Commit small, logically grouped changes, often. Subject in the imperative mood, ≤ 72 characters ("Add loans repository with open-loan guard"); add a body when the reason is not obvious.
- **No attribution to any AI tool, assistant or language model — anywhere.** No `Co-Authored-By` trailers naming one, no "generated with/by" footers, and no such mentions in pull request descriptions, code comments or docs. The `commit-msg` hook rejects offending commit messages, and CI runs the same hook on every commit of a push or pull request (`scripts/check-commit-messages.sh`), so a clone without the hook enabled is still caught; if it rejects a legitimate message, reword it rather than bypassing the hook.
- Never commit secrets, keystores or local tool configuration (see `.gitignore`).
- Pull requests: link the card ID(s), summarise what changed, list how it was verified (commands run, journeys, Maestro flows, screenshots), and include the `STATUS.md` tick.

## 6. Expo has changed — do not trust memory

Expo ships breaking changes every SDK release. APIs you remember may be renamed, moved or removed. Before writing code that touches an Expo, EAS or React Native API:

1. Check the major version of `expo` in `package.json` (currently 57).
2. Read the matching versioned docs: `https://docs.expo.dev/versions/v57.0.0/`.
3. For anything else, start from https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common misconceptions — and follow its links to the specific page you need.

Useful references:

- Expo Router: https://docs.expo.dev/router/introduction.md — import `Link`, `router` and `useLocalSearchParams` from `expo-router`.
- EAS (builds, submit, updates): https://docs.expo.dev/eas/index.md — run the CLI as `npx eas-cli@latest <command>` in place of bare `eas`. Local builds (`eas build --local`) keep releases free ([ADR 0011](docs/adr/0011-free-android-release-pipeline.md)).
- Expo SDK modules: https://docs.expo.dev/versions/latest/index.md
