# 0004. Plans tracked publicly in the repo

- Status: Accepted
- Date: 2026-09-25

## Context

MyShelf is a public portfolio project and work on it often happens in parallel. Anyone picking up a task, including someone new to the codebase, needs the same, current picture of the architecture, the remaining work and what "done" means. Keeping plans in a private tool would hide the design thinking that makes the repo a good portfolio piece.

## Decision

Track the plan in the repository: `PLAN.md` (overview, architecture, strategy), `docs/plan/phase-NN-*.md` (task cards per phase), `STATUS.md` (checklist of every task card), `docs/adr/` (decisions), `AGENTS.md` (how to pick up and do work). Task cards are ticked in `STATUS.md` in the same pull request that completes them.

## Consequences

- Anyone can pick up a task cold by reading `PLAN.md` → `STATUS.md` → the phase doc.
- The docs must be kept honest: changes that alter a plan or decision update the docs in the same pull request, and a new ADR supersedes an old one rather than silently editing it.
- Nothing private (keys, personal data, local tool configuration) may be written into these docs.
