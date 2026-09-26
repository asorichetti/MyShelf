# 0008. Three-level testing strategy and a single regression gate

- Status: Accepted
- Date: 2026-09-25

## Context

The project is built incrementally by several contributors, including automated agents. It needs fast feedback, high confidence that nothing regressed, and evidence that UI work actually renders well — not just that code compiles.

## Decision

1. **Jest** (jest-expo + Testing Library) for every module: pure domain logic, repositories against real SQLite in Node, services with recorded fixtures, components and screens.
2. **auto-test-suite** (Go + Playwright, `tools/auto-test-suite`) against the web build: `navigate`, `screenshot`, `interact`, `journey`, `smoke`; JSON on stdout; an evidence bundle for every command; UX gates `pagestate`, `render`, `console`, `network`, `a11y` alongside assertions; self-registering journeys, one fresh browser per journey; API responses mocked from fixtures.
3. **Maestro** flows (`.maestro/`) on emulator/device for native-only features.

Every phase document lists the Jest tests, journeys and flows it adds. The **regression gate** for every task and phase is:

```bash
npm run check
auto-test-suite smoke --ux-gates fail
```

CI runs both on every push and pull request.

## Consequences

- UX quality (blank screens, console errors, accessibility) is checked automatically, with screenshots to review.
- Test ids must come from the shared selector contract ([0009](0009-generated-selector-contract.md)).
- Maestro is run locally (no free device farm), so device regressions are caught at phase end and release, not on every commit.
