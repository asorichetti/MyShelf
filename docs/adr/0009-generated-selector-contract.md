# 0009. Test ids generated from one `selectors.json`

- Status: Accepted; the Go output is removed by [0013](0013-typescript-auto-test-suite.md), so the generator emits only `src/testing/testids.gen.ts`, which the auto test suite imports
- Date: 2026-09-25
- Original title: "Test ids generated from one `selectors.json` into TS and Go" (the Go output was removed by [0013](0013-typescript-auto-test-suite.md))

## Context

The same element is found by Jest (TypeScript), the auto test suite (CSS selectors; written in Go at the time, TypeScript since [0013](0013-typescript-auto-test-suite.md)) and Maestro (YAML, Android resource ids). Hand-written id strings in three languages drift apart and break tests silently.

## Decision

- `src/testing/selectors.json` is the only place test ids are defined: `{ "<group>": { "<key>": "<kebab-case-id>" } }`, groups and keys camelCase, ids kebab-case and globally unique.
- `scripts/gen-selectors.mjs` (`npm run selectors:gen`) generates `src/testing/testids.gen.ts` (`Testids.group.key` → id), which is committed. The app, Jest and the auto test suite all import it; the suite builds CSS selectors with `tid(Testids.group.key)` → `[data-testid="id"]`. *Superseded by [0013](0013-typescript-auto-test-suite.md): the generator originally also emitted a Go file for the Go version of the tool.*
- `npm run selectors:check` (part of `npm run check`) fails if the generated file is stale.
- Maestro flows use the ids from `selectors.json` directly (`id: "shelf-add-button"`).
- Special group `pageState` (`page-content`, `page-error`, `page-loading`) marks screen state for the auto test suite's `pagestate` gate.

## Consequences

- Renaming an id is a one-line change plus regeneration; the TypeScript compiler (`npm run typecheck` for the app and Jest, `npm run autotest:check` for the journeys) catches every stale reference.
- Contributors must never type a raw test id string in app code, tests or journeys.
