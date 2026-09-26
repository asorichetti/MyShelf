# 0011. Free Android release pipeline

- Status: Accepted
- Date: 2026-09-25

## Context

The app must be free to build and distribute. Options: EAS Build (cloud; has a limited free tier), local Gradle builds from the generated native project, and GitHub Actions (free minutes for public repositories).

## Decision

- **CI:** GitHub Actions on every push and pull request runs `npm run check`, a web export and `auto-test-suite smoke --ux-gates fail`, plus `go vet`/`go test` for the auto-test-suite.
- **Builds:** `eas.json` defines `development`, `e2e`, `preview` (APK) and `production` (AAB) profiles. Builds can run on the EAS free tier or locally with `eas build --local` / `npx expo prebuild` + Gradle, which costs nothing.
- **Releases:** a tag-triggered GitHub Actions workflow builds a signed release APK/AAB with Gradle on the runner and attaches it to a GitHub Release. The upload keystore is kept out of the repo and supplied as encrypted repository secrets.
- Google Play publishing (one-time developer fee) is optional and outside the "free" requirement; GitHub Releases is the default distribution channel.

## Consequences

- No mandatory spend at any point.
- The release workflow must be kept in step with Expo's prebuild output; a failed release build is a blocking bug.
- Keystore loss would prevent updates to installed apps — the owner keeps an offline backup.
