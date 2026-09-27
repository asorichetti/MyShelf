# 0016. Text recognition through a local Expo module

- Status: Accepted
- Date: 2026-09-26
- Updates: [0003](0003-isbn-first-ocr-fallback-recognition.md) (the OCR library)

## Context

[0003](0003-isbn-first-ocr-fallback-recognition.md) chose on-device Google ML Kit text recognition through `@react-native-ml-kit/text-recognition`. With React Native 0.86, which runs only on the New Architecture, that package installs but `expo-doctor` reports it as untested on the New Architecture. The maintained Expo-module alternative, `expo-text-extractor`, returns the recognised text without the line frames the query builder ranks by (larger text is the title), so it cannot feed `buildQueriesFromOcr`.

## Decision

- The app has its own local Expo module, `modules/text-recognition` (Kotlin, Expo Modules API, found by autolinking), wrapping **ML Kit Text Recognition v2 with the bundled Latin model** (`com.google.mlkit:text-recognition`).
- It exposes `recognize(uri)` (blocks → lines with pixel frames, confidence and language; `file://` and `content://`; EXIF rotation applied) and `prepareCover(uri, maxHeight, focus)` (an upright 2:3 crop for using the photo as a cover).
- The model is bundled rather than downloaded through Google Play services: reading works offline, at once, and without Play services.
- Android only. iOS is not implemented: the JavaScript side (`requireOptionalNativeModule`) sees no module there, and the Scan tab offers typed cover text, as in Expo Go and on the web.

## Consequences

- `expo-doctor` stays clean, and the module runs on the New Architecture; the rest of 0003 is unchanged.
- The app owns about 200 lines of Kotlin, and upgrades ML Kit by editing `modules/text-recognition/android/build.gradle`.
- The APK is about 12.6 MB larger per ABI ([release.md](../release.md#the-bundled-text-recognition-model)).
- Like any native code, the module needs a development or release build; it is tested by Jest with the module mocked, and on an emulator with the Maestro cover-scan flows.
