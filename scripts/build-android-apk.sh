#!/usr/bin/env bash
# Builds a release APK on this machine (docs/device-testing.md, docs/release.md).
#
#   scripts/build-android-apk.sh e2e         [out.apk]   fixture loader on, for Maestro only
#   scripts/build-android-apk.sh production  [out.apk]   what users install (no fixture loader)
#
# ABIS (default arm64-v8a, which every current phone and an Apple-silicon
# emulator run) picks the native code built in; ABIS=all builds the universal
# APK. Signing follows plugins/withReleaseSigning.js: the upload key when the
# MYSHELF_UPLOAD_* values are set, the debug key otherwise.
#
# Needs JDK 17 and the Android SDK with ANDROID_HOME set (docs/release.md).
set -euo pipefail

kind=${1:-}
case "$kind" in
  e2e) e2e=1 ;;
  production) e2e=0 ;;
  *) echo "usage: $0 e2e|production [out.apk]" >&2; exit 2 ;;
esac
root=$(cd "$(dirname "$0")/.." && pwd)
out=${2:-$root/build/myshelf-$kind.apk}
abis=${ABIS:-arm64-v8a}

cd "$root"
# Metro inlines EXPO_PUBLIC_* at build time (ADR 0015); set it explicitly so no
# .env file decides whether the fixture loader is in the build.
export EXPO_PUBLIC_E2E=$e2e

EXPO_NO_GIT_STATUS=1 npx expo prebuild --platform android --clean --no-install

gradle_args=(assembleRelease)
[ "$abis" != all ] && gradle_args+=("-PreactNativeArchitectures=$abis")
# --rerun-tasks is not needed: prebuild --clean starts android/ afresh, so the
# JS bundle is always rebuilt with this build's EXPO_PUBLIC_E2E. Metro's
# transform cache is kept when CI is set, and is keyed on the EXPO_PUBLIC_*
# values (metro.config.js), so an E2E and a production build never share it.
(cd android && ./gradlew "${gradle_args[@]}")

mkdir -p "$(dirname "$out")"
cp android/app/build/outputs/apk/release/app-release.apk "$out"
echo "Built $out ($kind, ABIs: $abis, $(du -h "$out" | cut -f1))"
