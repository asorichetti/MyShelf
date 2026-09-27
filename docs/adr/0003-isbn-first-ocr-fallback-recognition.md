# 0003. ISBN barcode first, on-device OCR fallback, no server

- Status: Accepted
- Date: 2026-09-25

## Context

The owner wants to scan a book's cover and have MyShelf identify both the book and the *edition*. The app must be free to run: no paid vision APIs, no server. Image-similarity cover matching would need a hosted index of cover images (a server and storage costs) and still would not pin an edition reliably.

## Decision

A hybrid, fully on-device pipeline:

1. **Barcode first.** `expo-camera` `CameraView` scans EAN-13; a `978`/`979` EAN-13 is the ISBN-13 and identifies the exact edition.
2. **OCR fallback.** When there is no barcode or the ISBN is unknown, the user photographs the cover; Google ML Kit text recognition (on-device, free; through the app's own Expo module since [0016](0016-local-expo-module-for-text-recognition.md), first planned as `@react-native-ml-kit/text-recognition`) extracts text; a pure query builder turns it into title/author queries.
3. **Free metadata APIs.** Open Library (ISBN, works, editions, search, covers) and Google Books (volumes search), both keyless at low volume, called directly from the device with polite rate limiting, a descriptive User-Agent and a local cache.
4. **User confirms.** Results are shown as candidates in an edition picker; nothing is saved without the user choosing an edition or falling back to manual entry.

## Consequences

- Zero running cost; works for most books printed since the 1970s via the barcode.
- OCR requires a development build and is Android-tested with Maestro and by hand; the web target uses typed input instead.
- Coverage depends on Open Library and Google Books data quality; merging both, plus easy editing, mitigates gaps. Series data in particular is patchy and is parsed heuristically and confirmed by the user.
- Keyless quotas are per IP and generous for personal use; the app must still back off on `429` and cache aggressively.
  *Update (September 2026):* Google Books' keyless quota proved to be shared and exhausted (a limit of 0), so Google Books became optional and accepts a free API key from `.env.local`; Open Library alone is enough for every lookup. See PLAN.md §6.
