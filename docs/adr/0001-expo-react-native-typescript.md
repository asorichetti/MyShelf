# 0001. Expo React Native with TypeScript

- Status: Accepted
- Date: 2026-09-25

## Context

MyShelf targets Android phones (Google Pixel and Samsung Galaxy first). It needs the camera, barcode scanning, on-device OCR, SQLite and file sharing. It is built by one person as a free, open-source portfolio piece, so development speed, a strong ecosystem, good docs and free tooling matter more than squeezing out native performance. A browser build is also wanted for fast automated UI testing (see [0002](0002-web-target-for-automated-ui-testing.md)).

Options considered: native Kotlin + Jetpack Compose; Flutter; Expo React Native with TypeScript.

## Decision

Use **Expo (SDK 57) with React Native 0.86 and TypeScript in strict mode**, **Expo Router** for file-based navigation in `src/app`, and Expo modules wherever one exists (`expo-camera`, `expo-sqlite`, `expo-file-system`, `expo-sharing`, `expo-notifications`). Dependencies are always added with `npx expo install` so versions match the SDK. Native folders (`android/`, `ios/`) are generated (Continuous Native Generation) and never committed.

## Consequences

- One TypeScript codebase for Android, the web test target and (later, if wanted) iOS.
- `react-native-web` gives a real browser build for the auto-test-suite at almost no cost.
- ML Kit OCR is a third-party native module, so the app needs a **development build** (`expo-dev-client`), not Expo Go, from Phase 03 on.
- Expo changes APIs between SDKs; contributors must read the versioned docs for SDK 57 rather than rely on memory (spelled out in `AGENTS.md`).
- SDK upgrades are deliberate tasks with their own commits, run with `npx expo install --fix` and `npx expo-doctor`.
