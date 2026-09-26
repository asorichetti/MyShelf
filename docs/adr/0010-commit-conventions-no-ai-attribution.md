# 0010. Small commits; no AI/tool attribution, enforced by a hook

- Status: Accepted
- Date: 2026-09-25

## Context

The repository is a public portfolio piece; its history should read as a clean, reviewable record of the work. Some developer tooling adds attribution trailers or footers to commits by default. The owner does not want any such attribution anywhere in the project.

## Decision

- Commits are **small, logically grouped and frequent**, with plain descriptive subject lines in the imperative mood ("Add loans repository"), and a body when the reason is not obvious.
- **No attribution to any AI tool, assistant or model** anywhere: commit messages, trailers (`Co-Authored-By`), pull request descriptions, code comments or docs.
- `.githooks/commit-msg` rejects commit messages containing such attribution. Every clone enables it once with `git config core.hooksPath .githooks`.

## Consequences

- History is easy to review and bisect.
- The hook is a safety net, not a substitute for care: pull request descriptions and code comments are checked in review.
- The hook's pattern may occasionally reject a legitimate message that mentions a blocked word; reword the message rather than bypassing the hook.
