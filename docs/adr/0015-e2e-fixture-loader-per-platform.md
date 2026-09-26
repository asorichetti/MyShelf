# 0015. E2E fixture loader: on for the web test target, opt-in on Android

- Status: Accepted
- Date: 2026-09-26

## Context

From Phase 01, every auto test suite journey and Maestro flow starts from a known library by opening `/e2e?fixture=<name>&next=<route>`, which wipes the database and loads a fixture (P01-01). That route must never do anything in a build a user installs. The plan first gated it on `EXPO_PUBLIC_E2E=1` everywhere, set for `expo start` by `.env.development`. But CI runs the journeys against the static web export (`npm run export:web`, served with `--serve dist`), which is a production build and does not load `.env.development`, so the journeys there would find the loader switched off.

## Decision

- **Web:** the loader is on unless the build sets `EXPO_PUBLIC_E2E=0` (`src/features/e2e/e2eFlag.web.ts`). The web build exists only as a test target and is never shipped to users ([0002](0002-web-target-for-automated-ui-testing.md)), so the journeys work against the dev server and against any export, whatever command produced it.
- **Android (and iOS):** the loader exists only when the build sets `EXPO_PUBLIC_E2E=1` (`src/features/e2e/e2eFlag.ts`). `.env.development` sets it for `expo start`, so development builds used with Maestro have it; `expo export` and release builds do not load that file, and Metro inlines the variable at build time.
- In every build without the loader, `/e2e` renders the not-found screen and touches nothing (Jest covers both files).

## Consequences

- Hosting the web export publicly would expose a route that can wipe that browser's local library. That is acceptable only because the web build is not a product; hosting it for users would need `EXPO_PUBLIC_E2E=0` in that build, or this decision revisited.
- The release checklist (P09-10) verifies that the Android release bundle has the loader switched off.
