# Cover-scan flows

On-device flows for reading a book's cover (P03-05, P03-06, P03-14). They need
an **E2E build** (`EXPO_PUBLIC_E2E=1`, so `myshelf://e2e` loads fixtures) on an
emulator or phone, and network access for the catalogue searches.

| Flow | Checks |
|---|---|
| `cover-scan-practical-magic.yaml`, `cover-scan-nobodys-girl.yaml`, `cover-scan-problematic-summer-romance.yaml` | adds the developer's photo of the cover to the gallery; Scan → Cover → **Choose from your photos** → ML Kit reads it → the edition picker opens on the book → the first edition is saved → the book's page; when no online cover exists, Booky's "Use my photo" is accepted (P03-14). Screenshots: `<flow>-picker`, `<flow>-detail`. |
| `cover-scan-camera.yaml` | the camera refused twice → "Open settings", with **Choose from your photos** still offered; then allowed → the emulator's virtual scene camera → a photo → "Use this photo" → read without crashing (the scene has no cover, so Booky asks to fill the frame). |
| `cover-scan/read-photo.yaml` | the shared steps of the photo flows (a subflow; not run on its own). |

## The photos

The cover photos are the developer's and are **never committed** (the cover art
is not ours). Put JPEGs at `assets/test-images/<book>.jpg` (git-ignored), made
from the originals with:

```bash
swift scripts/prepare-test-photo.swift <original.png> assets/test-images/practical-magic.jpg
```

The script writes the pixels only: no capture date (so the photo picker lists
the photo first, where the flows tap) and no location.

## Running

```bash
maestro --device emulator-5556 test .maestro/cover-scan-practical-magic.yaml
maestro --device emulator-5556 test --include-tags cover-scan .maestro/
```

Each photo flow adds its photo to the gallery again (Maestro `addMedia`); clear
the emulator's `Pictures` folder now and then. To record what ML Kit read as an
OCR fixture, run `node scripts/record-mlkit-fixture.mjs` straight after a flow
(see the script's header).
