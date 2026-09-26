# 0002. Web build as a test target; Maestro for device-only flows

- Status: Accepted
- Date: 2026-09-25

## Context

UI tests on Android emulators are slow, flaky and hard to run on free CI. Screens, navigation, forms and most flows in MyShelf do not depend on native hardware. We want every screen checked on every change — for correctness and for UX quality (blank screens, console errors, accessibility) — with evidence (screenshots, DOM) that a reviewer can inspect.

## Decision

- Keep a **web build** (`react-native-web`, `npm run web`, `npm run export:web`) whose purpose is automated testing, not end users.
- Build an **auto test suite** in Go (`tools/auto-test-suite`, Cobra + playwright-go) that drives the web build in Chromium (headless in CI). Commands: `navigate`, `screenshot`, `interact`, `journey`, `smoke`. Every command writes an evidence bundle (screenshot, rendered DOM, console, failed network requests, gate results) and prints one JSON document to stdout. UX gates (`pagestate`, `render`, `console`, `network`, `a11y`) run alongside assertions. Journeys self-register and each runs in a fresh browser.
- Use **Maestro** YAML flows (`.maestro/`) on an emulator or device for features that need native modules: camera, barcode scanning, ML Kit OCR, sharing, notifications, Android back behaviour.
- Native-only services have web stubs (typed ISBN / typed cover text) so the rest of each flow is still testable on web.

## Consequences

- Fast, deterministic end-to-end coverage in CI with no device farm.
- Web-specific rendering differences can hide Android-only bugs; Maestro flows and a device checklist per phase cover that gap.
- Test ids must work on both platforms (`testID` renders as `data-testid` on web and as the resource id Maestro reads on Android), which is why they come from one generated contract ([0009](0009-generated-selector-contract.md)).
- The project carries a small Go codebase with its own `go vet`/`go test` in CI.
