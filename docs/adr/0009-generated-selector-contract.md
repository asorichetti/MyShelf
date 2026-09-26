# 0009. Test ids generated from one `selectors.json` into TS and Go

- Status: Accepted; the Go output is removed by [0013](0013-typescript-auto-test-suite.md), so the generator emits only `src/testing/testids.gen.ts`, which the auto test suite imports
- Date: 2026-09-25

## Context

The same element is found by Jest (TypeScript), the auto test suite (Go, CSS selectors) and Maestro (YAML, Android resource ids). Hand-written id strings in three languages drift apart and break tests silently.

## Decision

- `src/testing/selectors.json` is the only place test ids are defined: `{ "<group>": { "<key>": "<kebab-case-id>" } }`, groups and keys camelCase, ids kebab-case and globally unique.
- `scripts/gen-selectors.mjs` (`npm run selectors:gen`) generates `src/testing/testids.gen.ts` (`Testids.group.key` → id) and `tools/auto-test-suite/internal/selectors/selectors.gen.go` (`selectors.Group.Key` → `[data-testid="id"]`). Both generated files are committed.
- `npm run selectors:check` (part of `npm run check`) fails if the generated files are stale.
- Maestro flows use the ids from `selectors.json` directly (`id: "shelf-add-button"`).
- Special group `pageState` (`page-content`, `page-error`, and `page-loading` from P00-11) marks screen state for the auto test suite's `pagestate` gate.

## Consequences

- Renaming an id is a one-line change plus regeneration; TypeScript and Go compilers catch every stale reference.
- Contributors must never type a raw test id string in app code, tests or journeys.
