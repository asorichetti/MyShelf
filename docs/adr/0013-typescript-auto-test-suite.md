# 0013. Auto test suite in TypeScript with the Playwright library

- Status: Accepted
- Date: 2026-09-25
- Supersedes: the tool language in [0002](0002-web-target-for-automated-ui-testing.md) and [0008](0008-three-level-testing-strategy.md), and the Go output of the selector generator in [0009](0009-generated-selector-contract.md)

## Context

The auto test suite (`tools/auto-test-suite`) was first written in Go with Cobra and playwright-go. It worked, but it made MyShelf a two-language project: contributors needed a Go toolchain, CI needed a Go setup with its own format, vet and test steps, and the selector generator had to emit a second generated file (`selectors.gen.go`) that could drift from the TypeScript one. playwright-go is a community port that follows the official Playwright releases at a distance.

## Decision

- Port the auto test suite to **TypeScript** in `tools/auto-test-suite/src/`, using the official **Playwright library** (`playwright`, not the test runner) and **Commander** for the command line, run directly with **tsx** (no build step).
- Keep the tool's contract unchanged: the commands (`navigate`, `journey`, `smoke`, `screenshot`, `interact`), global flags, UX gates and their configuration, the five-file evidence bundle, JSON on stdout and the existing journeys.
- Package scripts: `autotest` (passthrough: `npm run -s autotest -- <command> [flags]`), `autotest:check` (typecheck + unit tests with Node's built-in test runner), `autotest:install-browser`, `autotest:smoke`, `autotest:journeys`.
- Journeys import `Testids` from `src/testing/testids.gen.ts`, the same generated module the app and Jest use; `scripts/gen-selectors.mjs` stops generating Go.
- No Go anywhere in the project; CI drops its Go setup.

## Consequences

- One language across the app, its tests and its tooling; one toolchain to install; the generated selector contract is a single file.
- Playwright's official library is first-party and gets new Chromium support and APIs on release.
- The tool runs through `tsx`, so there is no binary to build or keep fresh; start-up is slightly slower than a compiled binary, which does not matter next to browser launch time.
- The tool's type checking and unit tests become part of the Node toolchain (`npm run autotest:check`) rather than a separate Go job.
