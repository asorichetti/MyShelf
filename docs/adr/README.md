# Architecture Decision Records

Short records of the decisions that shape MyShelf. Each has **Context**, **Decision** and **Consequences**. Records are never rewritten to change a decision: add a new ADR that supersedes the old one and update the old one's status line.

| # | Title | Status |
|---|---|---|
| [0001](0001-expo-react-native-typescript.md) | Expo React Native with TypeScript | Accepted |
| [0002](0002-web-target-for-automated-ui-testing.md) | Web build as a test target; Maestro for device-only flows | Accepted; tool language superseded by 0013 |
| [0003](0003-isbn-first-ocr-fallback-recognition.md) | ISBN barcode first, on-device OCR fallback, no server | Accepted |
| [0004](0004-public-plans-in-repo.md) | Plans tracked publicly in the repo | Accepted |
| [0005](0005-sqlite-with-migrations-and-db-interface.md) | SQLite, versioned migrations, `Db` interface | Accepted |
| [0006](0006-data-model.md) | v1 data model | Accepted |
| [0007](0007-purple-library-theme-and-booky.md) | Purple library theme and the Booky helper | Accepted; palette and Booky accessibility superseded by 0014 |
| [0008](0008-three-level-testing-strategy.md) | Three-level testing strategy and regression gate | Accepted; tool language superseded by 0013 |
| [0009](0009-generated-selector-contract.md) | Generated selector contract | Accepted; Go output removed by 0013 |
| [0010](0010-commit-conventions-no-ai-attribution.md) | Commit conventions, no AI/tool attribution | Accepted |
| [0011](0011-free-android-release-pipeline.md) | Free Android release pipeline | Accepted |
| [0012](0012-local-only-data.md) | Local-only data, no accounts | Accepted |
| [0013](0013-typescript-auto-test-suite.md) | Auto test suite in TypeScript with the Playwright library | Accepted |
| [0014](0014-warm-paper-palette-and-labelled-booky.md) | Warm paper palette with role-named tokens, and a labelled Booky | Accepted |
| [0015](0015-e2e-fixture-loader-per-platform.md) | E2E fixture loader: on for the web test target, opt-in on Android | Accepted |
| [0016](0016-local-expo-module-for-text-recognition.md) | Text recognition through a local Expo module (ML Kit v2, bundled model; updates 0003) | Accepted |

Template for new records:

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
## Decision
## Consequences
```
