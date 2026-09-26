# Phase 09 — Polish, accessibility and release

## Goal

Ship v1.0: an accessible, fast, robust app with a dark theme, a free and repeatable release pipeline producing a signed APK/AAB on GitHub Releases, store-ready assets and a privacy policy, verified end to end on real Google and Samsung devices.

## Scope

- Accessibility audit and fixes (TalkBack, font scaling, contrast, targets).
- Dark theme.
- Performance and full-text search.
- Error boundaries and resilience.
- Icon/splash with Booky; screenshots; README media.
- Release configuration, CI release workflow, privacy policy, final device regression.

## Out of scope

- iOS release. Play Store publishing (optional, requires the one-time developer fee — see [ADR 0011](../adr/0011-free-android-release-pipeline.md)).

## Prerequisites

- Phases 00–08 complete.

---

## Task cards

### P09-01 Accessibility audit and fixes

- **Description:** Walk every screen with TalkBack on a device and with the auto-test-suite `a11y` gate on web. Check: every control has a role and name; headings mark sections; focus order logical; state changes announced; 48 dp targets; layouts at 200 % font scale and display size "Largest"; no information by colour alone. File and fix issues; record the audit in `docs/accessibility.md`.
- **Files:** components/screens as needed; `docs/accessibility.md`.
- **Acceptance:** zero serious/critical axe issues across all journeys; TalkBack walkthrough of the core flows (scan → save, lend → return, group) succeeds without sighted help.
- **Tests:** new auto-test-suite journey `a11y-large-text` (web zoom 200 %); component tests for any fixed labels.

### P09-02 Dark theme

- **Description:** Dark token set from `PLAN.md` §9; follow system by default with a Settings override (System / Light / Dark); `app.json` `userInterfaceStyle` → `automatic`; Booky and motifs (catalogue cards become "night reading" cards) adapted; CSS vars switch on web via `prefers-color-scheme` and a data attribute.
- **Files:** `src/theme/tokens.ts`, `src/theme/index.ts`, `src/app/settings/preferences.tsx`, `app.json`, SVG components.
- **Acceptance:** all text pairs ≥ 4.5:1 in dark (unit test); every screen screenshot reviewed in both themes.
- **Tests:** `src/theme/__tests__/contrast.dark.test.ts`; journey `theme-dark-gallery`.

### P09-03 Performance and full-text search

- **Description:** Profile with the `large` fixture (2,000 books) and a generated 10,000-book fixture: startup to interactive < 2 s on a mid-range device, shelf scroll without dropped frames, search < 100 ms. Add migration `0004_books_fts` with an FTS5 virtual table over title, subtitle, authors, series, ISBN, kept in sync by triggers; switch search to FTS with a `LIKE` fallback if FTS5 is unavailable. Tune list props (`getItemLayout`, `windowSize`), memoisation, image sizes.
- **Files:** `src/db/migrations/0004_books_fts.ts`, `src/db/repositories/books.ts`, list components, `src/testing/fixtures/huge.ts`.
- **Acceptance:** targets met and recorded in the PR with measurements; FTS results identical to `LIKE` results on test cases.
- **Tests:** `src/db/repositories/__tests__/books.fts.test.ts`; journey `shelf-large-scroll` (timing recorded in evidence).

### P09-04 Error boundaries and resilience

- **Description:** Root and per-screen error boundaries rendering `page-error` with Booky (*concerned*), "Try again" and "Copy error details" (local only, no reporting service). Handle DB open/migration failure with a recovery screen offering export of the raw DB file. Guard every async action against unmount.
- **Files:** `src/components/ui/ErrorBoundary.tsx`, `src/app/_layout.tsx`, `src/db/DbProvider.tsx`.
- **Acceptance:** thrown render error in a screen shows the boundary, not a blank screen; migration failure screen reachable via a test hook.
- **Tests:** `src/components/ui/__tests__/ErrorBoundary.test.tsx`, `src/db/__tests__/DbProvider.failure.test.tsx`.

### P09-05 App icon, splash and store graphics

- **Description:** Final adaptive icon (Booky on lavender, monochrome variant for themed icons), splash with Booky and the wordmark, feature graphic (1024×500) and screenshots. Assets exported from SVG sources kept in `assets/source/`.
- **Files:** `assets/*`, `assets/source/*.svg`, `app.json`.
- **Acceptance:** icon legible at 48 px, correct in themed-icon mode on Android 13+; splash has no flash of white.
- **Tests:** Maestro `launch.yaml` screenshot; manual review.

### P09-06 Release build configuration

- **Description:** `eas.json` `production` (AAB) and `preview` (APK) finalised; `app.json` `version` and `android.versionCode` strategy (versionCode from CI run number or EAS `autoIncrement`); Android permissions minimised (camera, notifications only; remove unused ones via `android.blockedPermissions`); local signed build documented (`npx expo prebuild -p android` then `./gradlew bundleRelease` / `assembleRelease` with keystore properties from environment variables — never committed).
- **Files:** `eas.json`, `app.json`, `docs/release.md`.
- **Acceptance:** a signed release APK installs on a clean device and passes the Maestro suite; manifest lists only the required permissions.
- **Tests:** Maestro suite on the release APK.

### P09-07 CI release workflow

- **Description:** `.github/workflows/release.yml` on tags `v*`: run the regression gate; set up Java and Android SDK; `npx expo prebuild -p android --clean`; decode the keystore from repository secrets; `./gradlew assembleRelease bundleRelease`; attach APK and AAB plus SHA-256 checksums to a GitHub Release with notes from the tag message.
- **Files:** `.github/workflows/release.yml`, `docs/release.md`.
- **Acceptance:** pushing a test tag (`v0.9.0-rc1`) produces a draft release with both artifacts; secrets never printed.
- **Tests:** the workflow run itself.

### P09-08 Screenshots and README media

- **Description:** Use `auto-test-suite screenshot` with the `demo` fixture at phone viewport, light and dark, for Shelf (each view mode), book detail, edition picker, Loans, Groups, series detail, Booky onboarding; plus device screenshots from Maestro for the camera screens. Save curated images in `docs/media/` and embed in `README.md`.
- **Files:** `docs/media/*.png`, `README.md`.
- **Acceptance:** README shows current UI; images < 300 KB each.
- **Tests:** none beyond the journeys used to capture.

### P09-09 Privacy policy

- **Description:** `docs/privacy.md`: no accounts, no analytics, no ads; data stays on the device; network requests to Open Library and Google Books contain only ISBNs/search text; camera images processed on device and discarded; notifications are local; how to export and erase data. Linked from About (P08-08) and the README.
- **Files:** `docs/privacy.md`.
- **Acceptance:** statements match the code (reviewed against `src/services`).
- **Tests:** none.

### P09-10 Final device regression

- **Description:** Release checklist in `docs/release.md`: full `maestro test .maestro/` (including `manual`-tagged flows) on a Google Pixel (or Pixel emulator) and a Samsung Galaxy device on the release APK; TalkBack pass; offline pass; fresh install and upgrade-from-previous-release (migrations) pass; E2E routes inert in the release build.
- **Files:** `docs/release.md`.
- **Acceptance:** checklist completed and linked in the release PR.
- **Tests:** the checklist.

### P09-11 Localisation readiness

- **Description:** Move all user-facing strings (including Booky tips) into `src/i18n/en.ts` with a tiny `t()` helper; dates/numbers via `Intl`. English only for v1, but no hard-coded strings in components.
- **Files:** `src/i18n/*`, components.
- **Acceptance:** lint rule or test fails on string literals in JSX text outside `src/i18n` (with an allowlist for test ids and symbols).
- **Tests:** `src/i18n/__tests__/strings.test.ts`.

### P09-12 v1.0 release

- **Description:** Update `README.md` status, `STATUS.md`, version to 1.0.0, tag `v1.0.0`, publish the GitHub Release with APK/AAB and changelog (`CHANGELOG.md` created here, summarising phases).
- **Files:** `README.md`, `STATUS.md`, `CHANGELOG.md`, `app.json`, `package.json`.
- **Acceptance:** release downloadable; install from the APK on a clean device works; all STATUS items ticked.
- **Tests:** release workflow + P09-10 checklist.

---

## Test ids to add to `selectors.json`

```json
{
  "errorBoundary": { "root": "error-boundary-root", "retry": "error-boundary-retry", "copy": "error-boundary-copy" },
  "recovery": { "root": "db-recovery-root", "exportRaw": "db-recovery-export-raw" },
  "themeSetting": { "system": "theme-system", "light": "theme-light", "dark": "theme-dark" }
}
```

## auto-test-suite journeys

| Journey | Tags | Steps |
|---|---|---|
| `a11y-large-text` | `p09` | set page zoom 200 %; visit every tab and book detail; render gate (no overflow) + a11y gate |
| `theme-dark-gallery` | `p09` | emulate `prefers-color-scheme: dark`; screenshot every main screen; a11y gate (contrast) |
| `shelf-large-scroll` | `p09` | fixture `large`; scroll to end; record timing; no console errors |
| `error-boundary` | `p09` | E2E hook throws in a screen → `errorBoundary.root` → retry recovers |
| `release-screenshots` | `p09` | capture the curated set for P09-08 |

## Maestro flows

| Flow | Checks |
|---|---|
| `.maestro/release-smoke.yaml` | on the release APK: launch, onboarding, add manual book, lend/return, backup share sheet |
| `.maestro/upgrade-migration.yaml` | manual-assisted (tagged `manual`): install previous release, add data, install new release, data intact |
| full suite | `maestro test .maestro/` on Pixel and Samsung per P09-10 |

## Risks

| Risk | Mitigation |
|---|---|
| Release build differs from dev (minification, Hermes) | E2E profile is release-like; Maestro on release APK |
| Keystore handling | secrets only; offline backup by the owner; documented recovery |
| Samsung-specific behaviour (One UI camera, font sizes) | device pass on a Samsung phone in P09-10 |
| FTS5 missing on some SQLite builds | feature-detect at migration time; `LIKE` fallback |

## Regression gate

Before any card in this phase is ticked, and before the phase is closed, both must be green locally and in CI:

```bash
npm run check                    # selectors:check + typecheck + Jest (+ lint once P00-20 lands)
auto-test-suite smoke --ux-gates fail     # via `npm run ui -- smoke --ux-gates fail` once P00-17 lands
```

Phase close also requires every journey tagged `p09` to pass (`auto-test-suite journey --tag p09 --ux-gates fail`) and the Maestro flows above to have been run on an emulator or device, with the result noted in the pull request.

## Exit criteria

- v1.0.0 tagged; signed APK and AAB attached to a GitHub Release by CI.
- Accessibility audit complete with no open serious issues; dark theme shipped.
- All journeys pass with `--ux-gates fail`; full Maestro suite passes on a Pixel and a Samsung device.
- Every card in `STATUS.md` ticked.
