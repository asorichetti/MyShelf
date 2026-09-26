# 0005. SQLite via expo-sqlite, versioned migrations, `Db` interface

- Status: Accepted
- Date: 2026-09-25

## Context

All data is local ([0012](0012-local-only-data.md)). The data is relational (books ↔ authors, genres, series, groups, loans) and needs constraints such as "at most one open loan per book". Repositories must be unit-tested quickly in Jest, which runs in Node, where `expo-sqlite`'s native module is not available.

## Decision

- Store data in **SQLite via `expo-sqlite`**.
- Put all SQL behind a small **`Db` interface** in `src/db` (roughly: `exec(sql)`, `run(sql, params)`, `get<T>(sql, params)`, `all<T>(sql, params)`, `transaction(fn)`), with two adapters: `expo-sqlite` for the app and a Node adapter (`node:sqlite`, falling back to `better-sqlite3` if needed) for Jest.
- Evolve the schema only through **numbered, forward-only migrations** in `src/db/migrations`, applied in order at start-up and recorded with `PRAGMA user_version`. A released migration is never edited; fixes are new migrations.
- Access data only through **repositories** (`src/db/repositories`) that return domain types from `src/domain`. No SQL in components, hooks or screens.
- Enable `PRAGMA foreign_keys = ON` on every connection.

## Consequences

- Repository tests run against a real SQLite engine in milliseconds, including constraint behaviour.
- Care is needed to use SQL supported by both engines (both are modern SQLite, so this is rarely an issue).
- The web target runs `expo-sqlite`'s web implementation, which needs cross-origin isolation headers when served; if that proves unreliable, the `Db` interface allows swapping in a different web adapter without touching repositories.
- Backup/import (Phase 08) must record the schema version and migrate older backups forward.
