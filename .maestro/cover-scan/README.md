# Cover-scan flows

On-device flows for reading a book's cover (P03-05, P03-06, P03-14). They need
an **E2E build** (`EXPO_PUBLIC_E2E=1`, so `myshelf://e2e` loads fixtures) on an
emulator or phone, and network access for the catalogue searches.

| Flow | Checks |
|---|---|
| `cover-scan-synthetic.yaml` (in `.maestro/`) | the same steps with a made-up cover lettered "The Colour of Magic" by Terry Pratchett (`synthetic-colour-of-magic.jpg`, ours and committed; rendered by `scripts/make-synthetic-cover.mjs`), so cover reading is tested in CI and in a fresh clone. |
| `photo-practical-magic.yaml`, `photo-nobodys-girl.yaml`, `photo-problematic-summer-romance.yaml` (here) | adds the developer's photo of the cover to the gallery; Scan → Cover → **Choose from your photos** → ML Kit reads it → the edition picker opens on the book → the first edition is saved → the book's page; when no online cover exists, Booky's "Use my photo" is accepted (P03-14). Screenshots: `<flow>-picker`, `<flow>-detail`. |
| `cover-scan-camera.yaml` (in `.maestro/`) | the camera refused twice → "Open settings", with **Choose from your photos** still offered; then allowed → the emulator's virtual scene camera → a photo → "Use this photo" → read without crashing (the scene has no cover, so Booky asks to fill the frame). |
| `read-photo.yaml` (here) | the shared steps of the photo flows (a subflow; not run on its own). |

## The photos

The cover photos are the developer's and are **never committed** (the cover art
is not ours). Put JPEGs at `.maestro/cover-scan/photos/<book>.jpg` (git-ignored;
Maestro only adds media from inside the `.maestro` folder), made from the
originals (the developer keeps them in `assets/test-images/`, also git-ignored) with:

```bash
swift scripts/prepare-test-photo.swift assets/test-images/<original>.png .maestro/cover-scan/photos/practical-magic.jpg
```

The script writes the pixels only: no capture date (so the photo picker lists
the photo first, where the flows tap) and no location.

The photo flows live in this folder, not in `.maestro/`, because Maestro checks
the media of every flow in a folder before running any of them (even ones a tag
excludes): with a photo missing, `maestro test .maestro/` would not start.

## Running

`scripts/maestro-suite.sh` runs `cover-scan-camera.yaml` and
`cover-scan-synthetic.yaml` with the rest of the suite, then each
`photo-<book>.yaml` whose photo is in `photos/`. By hand:

```bash
maestro --device emulator-5556 test .maestro/cover-scan/photo-practical-magic.yaml
maestro --device emulator-5556 test .maestro/cover-scan-synthetic.yaml .maestro/cover-scan-camera.yaml
```

Each photo flow adds its photo to the gallery again (Maestro `addMedia`); clear
the emulator's `Pictures` folder now and then. The system photo picker indexes a
new photo a few seconds late, so the flows open it once, back out, then open it
again before tapping the newest photo. To record what ML Kit read as an
OCR fixture, run `node scripts/record-mlkit-fixture.mjs` straight after a flow
(see the script's header).
