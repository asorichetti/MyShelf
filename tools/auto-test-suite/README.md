# auto-test-suite

Browser automation for the MyShelf web build (Expo Router + React Native Web),
written in TypeScript with the Playwright library and Commander, run with
`tsx` (no build step).

It is an **evidence generator that also fails**. Every browser command leaves a
bundle behind — screenshot, rendered DOM, console log, failed network requests
and gate results — in a fresh directory, prints one JSON document on stdout and
exits non-zero when something is wrong. The exit code is a convenience; the
bundle is the product.

```
tools/auto-test-suite/
├── package.json                 {"type": "module"} for the tool's sources
├── tsconfig.json                strict; typechecked by npm run autotest:check
└── src/
    ├── cli.ts                   entry point: global flags, error JSON, exit code
    ├── selectors.ts             Testids (generated) + tid() -> [data-testid="..."]
    ├── errors.ts
    ├── commands/                root helpers, navigate, journey, smoke, screenshot, interact
    ├── browser/                 Chromium lifecycle, listeners, run bundle
    ├── server/                  static file server for --serve (SPA fallback, COOP/COEP)
    ├── uxgates/                 pagestate, render, console, network, a11y, recorder
    │   ├── gates.config.json    render/a11y configuration
    │   ├── console_allowlist.json
    │   └── selftest/            fixture pages + gates.selftest.ts (every rule fires)
    └── journeys/                registry.ts + one *.journey.ts file per area
```

Unit tests (`*.test.ts`) sit beside the code and run on Node's built-in test
runner (`npm run autotest:check`). The gate self-tests (`*.selftest.ts`) need
Chromium and run separately (`npm run autotest:selftest`, see
[Proving the gates fire](#proving-the-gates-fire)).

## Setup

Requirements: Node (the version CI uses is in `.github/workflows/ci.yml`) and
npm. Playwright, Commander and tsx are pinned dev dependencies of the app, so
`npm ci` installs everything.

```bash
npm ci                               # app + tool dependencies
npm run autotest:install-browser     # one time: Playwright's Chromium
```

Start the app's web server in another terminal:

```bash
CI=1 npx expo start --web --port 8081
```

`CI=1` turns off Metro's file watcher. **After adding or renaming a route,
restart the server**; otherwise the new route renders the not-found screen and
the pagestate gate (correctly) fails. The dev server also sets the COOP/COEP
headers that expo-sqlite needs on web (`metro.config.js`); a server without
them cannot open the database and the Shelf never leaves its loading state.

Or test the static export instead, with no dev server at all:

```bash
npm run export:web                                 # writes dist/
npm run -s autotest:smoke -- --serve dist          # serves dist on a free port for this run
```

Then:

```bash
npm run -s autotest:smoke                          # core suite, gates=fail, headless
npm run -s autotest:journeys                       # every journey (gates=warn unless you pass --ux-gates)
npm run -s autotest:journeys -- --ux-gates fail    # extra flags go after --
npm run -s autotest -- journey --list              # any command: npm run -s autotest -- <command> [flags]
npm run autotest:check                             # typecheck the tool + unit tests
npm run autotest:selftest                          # gate self-tests in Chromium (no app server needed)
```

Use `npm run -s` when you want to parse stdout: without `-s`, npm prints its
own banner lines on stdout before the JSON. In the examples below,
`auto-test-suite` stands for `npm run -s autotest --`.

## The bundle

Each browser command (and each journey) creates
`<screenshot-dir>/<command>-<unixMillis>/` and always writes five files:

| File | Contents |
|---|---|
| `screenshot.png` | Full-page screenshot of the final state |
| `page.html` | The rendered DOM (`page.content()`), not the server HTML |
| `console.json` | Every console message and uncaught page error |
| `network.json` | Only failed traffic: status >= 400, or no response (status 0 + failure text) |
| `uxgates.json` | Mode, waivers and every gate result with findings and evidence |

Some journeys add named screenshots (e.g. `home-mobile.png`, `tab-loans.png`).
The bundle is written from a `finally` block, and `RunBundle.close()` writes it
as a last resort if nothing else managed to, so failed runs — the ones you need
evidence for — always have one. If Chromium itself cannot start, the run
directory still gets `page.html`, `console.json`, `network.json` and
`uxgates.json` explaining why. Run directories are timestamped and never
overwritten. `/screenshots/` and `/tools/auto-test-suite/screenshots/` are
gitignored.

## Output contract

- **stdout** is exactly one JSON document per invocation, including on errors
  (`{"command": ..., "ok": false, "error": ...}` for bad flags, a missing
  command or an unknown journey). `--help` prints usage instead.
- **stderr** carries human progress.
- **exit code** is 0 on success, 1 on any assertion failure, gate failure in
  `fail` mode, or usage error.

Example (`auto-test-suite smoke`, trimmed):

```json
{
  "command": "smoke",
  "ok": true,
  "selection": "all suite=core",
  "gatesMode": "fail",
  "viewport": "mobile",
  "baseUrl": "http://localhost:8081",
  "total": 3, "passed": 3, "failed": 0,
  "durationMs": 2398,
  "results": [
    {
      "name": "home-loads", "suite": "core", "ok": true, "durationMs": 704,
      "gates": {"mode": "fail", "failed": false, "results": 6, "findings": 0, "findingsByGate": {}},
      "artifacts": {
        "runDir": ".../screenshots/journey-home-loads-1790387219928",
        "screenshot": ".../screenshot.png", "html": ".../page.html",
        "console": ".../console.json", "network": ".../network.json", "uxgates": ".../uxgates.json"
      }
    }
  ]
}
```

A failing assertion reads without opening the source, e.g.
`"error": "/: expected h1 \"MyShelves\", found \"MyShelf\""`, and failing gate
findings are flattened into `gateFailures`, e.g.
`"render/overflow [/broken @mobile]: content overflows sideways at 390px: div[data-testid=\"too-wide\"] (right=3008px)"`.

## Global flags

Global flags may come before or after the command name.

| Flag | Default | Notes |
|---|---|---|
| `--env` | `local` | `local` = `http://localhost:8081`. There is no preview environment yet |
| `--base-url` | | Overrides `--env` (e.g. a server on another port) |
| `--serve` | | Serve a static web export (e.g. `dist` from `npm run export:web`) on a free `127.0.0.1` port for this run and test that. Mutually exclusive with `--base-url` and an explicit `--env`. See [Serving the export](#serving-the-export) |
| `--headless` | computed | `true` when `CI` is set; `false` when `DISPLAY`/`WAYLAND_DISPLAY` is set; otherwise `false` on macOS and `true` elsewhere (containers have no display). `--headless` alone means true; `--headless=false` shows the window |
| `--screenshot-dir` | `./screenshots` | Parent directory for run bundles, relative to the current directory |
| `--ux-gates` | `warn` | `off` (skip gates), `warn` (record findings, do not fail), `fail` |
| `--viewport` | `mobile` | `mobile` 390x844, `tablet` 820x1180, `desktop` 1280x900. `AUTOTEST_VIEWPORT_HEIGHT` overrides the height |
| `--color-scheme` | browser default | `light`, `dark`, `no-preference` |
| `--gates-config` | shipped file | Path to an alternative `gates.config.json` |
| `--console-allowlist` | shipped file | Path to an alternative `console_allowlist.json` |
| `--mock-api` | `src/services/metadata/__fixtures__` | Fixture directory with an `index.json` that answers Open Library, Google Books and covers requests; `off` disables mocking (covers are still answered by the test JPEGs). See [API mocking](#api-mocking) |

All of them are validated before a browser starts. The default viewport is
`mobile` because MyShelf is a phone app rendered on the web; `desktop` exists
to exercise layout from the other side.

## Commands

### `navigate`

Open a page, wait for the content marker, run all gates, capture a bundle.

```bash
auto-test-suite navigate --url /
auto-test-suite navigate --url / --wait 2000 --ux-gates fail
auto-test-suite navigate --url /somewhere --marker '[data-testid="not-found-root"]'
```

| Flag | Default | Notes |
|---|---|---|
| `--url` | `/` | Path joined to the base URL, or an absolute URL |
| `--wait` | `0` | Extra ms after the page rendered, so async requests (a fetch in an effect) land before the console/network gates snapshot |
| `--marker` | page-content testid | Selector that means "rendered" |

### `journey`

```bash
auto-test-suite journey --list                 # every journey with suite and description (JSON + stderr table)
auto-test-suite journey home-loads not-found   # by name
auto-test-suite journey --suite core
auto-test-suite journey --grep home            # JavaScript regexp over name and description
auto-test-suite journey --all
auto-test-suite journey --all --exclude-suite core   # everything smoke did not run (repeatable)
```

`--list` combines with `--suite`/`--exclude-suite`/`--grep` to preview a selection. Each journey
runs in a **fresh browser, page and run directory**.

### `smoke`

`journey --suite core` with `--ux-gates fail` and `--headless`. Either default
is only applied when you did not pass that flag yourself. This is what CI runs.

### `screenshot`

Viewport x colour-scheme matrix. A page's colour scheme is fixed at creation,
so every combination gets its own browser and bundle.

```bash
auto-test-suite screenshot --url / --viewports mobile,tablet,desktop --schemes light,dark
```

| Flag | Default |
|---|---|
| `--url` | `/` |
| `--viewports` | `mobile,desktop` |
| `--schemes` | `light,dark` |
| `--marker`, `--wait` | as for `navigate` |

The render gate runs at each combination's own viewport. (The app only has a
light theme today, so the dark captures look the same; the emulated
`prefers-color-scheme` does reach the page.)

### `interact`

One action, for poking at a page. Anything worth checking twice becomes a
journey.

```bash
auto-test-suite interact click --url / --testid tab-loans
auto-test-suite interact fill  --url /search --selector 'input[name=q]' --value dune
auto-test-suite interact press --url / --key Tab                 # page-level key press
auto-test-suite interact focus --url / --testid home-title
```

| Flag | Notes |
|---|---|
| `--url` | Page to open first (default `/`) |
| `--selector` / `--testid` | Target element (a Playwright selector, or a bare data-testid) |
| `--value` | Text for `fill` |
| `--key` | Key for `press` (`Tab`, `Enter`, `Escape`, `ArrowDown`, ...) |
| `--settle` | ms to let the UI settle after the action (default 300) |
| `--marker` | As for `navigate` |

The output's `after.focus` reports the focused element and its ARIA state
(`aria-selected`, `aria-expanded`, `aria-current`, ...), and `finalUrl` where
the action led.

## Gates

Gates run alongside assertions. Assertions prove the feature works; gates prove
the page was not silently broken while it worked. In `fail` mode both fail the
run. Order per page load: **pagestate**, then **render** (at the selected
viewport *and* the other end of the width range — mobile runs also check
desktop and vice versa), then **a11y**. **console** and **network** run at the
end of the command or journey, after the assertions.

If pagestate fails, render and a11y are skipped for that page (on a blank page
they only add noise); console and network still run because they usually
explain the blank page.

| Gate | Fails when |
|---|---|
| `pagestate` | No visible content marker (`page-content` testid, or `--marker`) within 15 s; a visible `page-error` testid; or the visible `main` has fewer than 10 characters of text. Only visible markers count, because a stack keeps the screens underneath in the DOM, hidden, with their own markers |
| `render` | The page rendered but is not styled (rules below) |
| `console` | A console error or uncaught exception that is not allowlisted |
| `network` | Any response >= 400 or request that got no response (rules `http-status`, `request-failed`); a request that left the app with no mock fixture (rule `unmocked`, see [API mocking](#api-mocking)) |
| `a11y` | Structural accessibility regressions (rules below) |

The render and a11y audits are typed functions (`renderAudit`, `a11yAudit`)
passed to `page.evaluate`, which serializes their source into the page. Keep
them self-contained: nothing they close over reaches the page. `tsx` wraps
named inner functions in a `__name(...)` helper; `Browser.newPage` defines that
helper as the identity function in every page, so journeys can pass functions
to `page.evaluate` too. Without it every audit reports an `evaluate` finding.

### Render rules

All run in one `page.evaluate`, after `document.fonts.ready`.

| Rule | Fails when |
|---|---|
| `stylesheets` | No stylesheet with readable rules |
| `tokens` | A CSS custom property in `render.requiredTokens` is empty on `:root` |
| `body-margin` | `body` margin is not 0 (the reset did not apply; browser default is 8px) |
| `body-background` | `body` background is transparent |
| `body-font` | `body` computes to the default serif (Times/serif/-webkit-standard) |
| `text-font` | The first real text inside `main` computes to the default serif |
| `fonts-loaded` | No `document.fonts` entry has status `loaded` |
| `fonts-error` | Any `document.fonts` entry has status `error` |
| `images` | An `<img>` is not `complete` with `naturalWidth > 0` (images whose URL carries the expected-missing marker are skipped). Images still downloading get up to 5 s to load or fail first, so a slow cover is not reported as broken |
| `overflow` | `scrollWidth > clientWidth + 1`, or a visible element extends past the right edge outside a horizontal scroll container. The finding names the outermost offending elements |
| `landmarks` | A selector in `render.landmarks` (default `main`) is missing, hidden or zero-size |

Styling is asserted through **computed styles**, never class names:
react-native-web generates its class names.

### Accessibility rules

One `page.evaluate`; elements hidden with `display:none`, `visibility:hidden`
or inside `aria-hidden="true"` are ignored, because navigators keep inactive
screens mounted.

| Rule | Fails when |
|---|---|
| `one-h1` | Not exactly one level-1 heading (`h1` or `role="heading" aria-level="1"`) |
| `heading-order` | A heading level skips on the way down (h1 -> h3) |
| `img-alt` | An `<img>` has no `alt` attribute (empty alt is a valid choice) |
| `accessible-name` | A button, link, tab, menuitem, switch or checkbox has no accessible name |
| `skip-link` | The first focusable element is not an in-page link |
| `one-main` | Not exactly one visible `main` landmark |
| `nav-labels` | A `nav` has no `aria-label`, or two share one |
| `html-lang` | `<html>` has no `lang` |
| `target-size` | A visible, enabled button, link, tab, menuitem, switch or checkbox has a bounding box smaller than `a11y.minTargetSize` (48 × 48 CSS px, the plan's 48 dp) in either dimension. The finding names the element, its accessible name and its size. Exempt: disabled controls (`disabled`, `aria-disabled="true"`) and a link inside running text (computed `display: inline` with other text in the same block), whose height is set by the line. The box is the hit area: react-native-web ignores `hitSlop`, so a small `Pressable` has to be given a bigger box, not a slop |

The gate does not judge whether alt text is useful or focus order is sensible;
that needs a human.

### Configuration: `src/uxgates/gates.config.json`

```json
{
  "render": { "requiredTokens": ["--ms-..."], "landmarks": ["main"], "disabled": { "<rule>": "<reason>" } },
  "a11y":   { "minTargetSize": 48, "disabled": { "<rule>": "<reason>" } }
}
```

`--gates-config` points at another copy. Unknown rule ids, unknown fields,
tokens that are not custom properties, and disabled rules without a reason are
rejected before any browser starts. Disabled rules are listed under `skipped`
in every result in `uxgates.json`.

Current decisions for this app:

| Setting | State | Why |
|---|---|---|
| a11y `skip-link` | off | MyShelf is a mobile app rendered with react-native-web: there is no repeated header/nav block before the content, and a skip link has no native iOS/Android equivalent |
| render `landmarks` | `main` only | Header and footer landmarks are optional in a mobile app shell |
| a11y `minTargetSize` | 48 | `AGENTS.md` and `PLAN.md` require touch targets of at least 48 dp; one CSS px is one dp in the web build. WCAG 2.5.5 (AAA) asks for 44 and 2.5.8 (AA) for 24, so 48 is stricter than both |
| render `requiredTokens` | core `--ms-*` tokens | Primary, paper, surface, ink and muted-ink colours, the heading and body fonts, one spacing and one radius step. The theme writes them onto `:root` at runtime; if it stops, the gate fails |

Every other render and a11y rule is on.

### Console allowlist: `src/uxgates/console_allowlist.json`

```json
[{ "pattern": "<JavaScript regexp>", "reason": "<why this error is acceptable>" }]
```

Both fields are required. Keep patterns narrow: one broad pattern added to fix
one journey buries the next real bug. It is currently empty.

### Deliberately missing URLs

A journey that tests the not-found screen requests a missing route on purpose.
Do **not** allowlist 404s for it. Put `ExpectedMissingMarker`
(`__expected-404`, in `src/uxgates/expected.ts`) in the URL instead; the
console and network gates both skip URLs and messages containing it, the
render gate's `images` rule skips images whose URL contains it, and nothing
else. The demo fixture's deliberately broken cover uses it too.

### API mocking

Journeys never touch the real book APIs. Every page the suite opens (every
command, every journey) gets a Playwright route handler before it navigates
(`src/mockapi/`, registered in `Browser.newPage`), so even the first request
is covered:

- Requests to `openlibrary.org` and `www.googleapis.com` are answered from the
  fixture index given by `--mock-api <dir>` (default
  `src/services/metadata/__fixtures__`, so `smoke` needs no flag).
- Requests to the cover hosts (`covers.openlibrary.org`, and
  `books.google.com` for Google Books thumbnails shown in lookup results) are
  answered from the index when it has an entry, and otherwise by the
  generated test JPEGs (see [Book covers](#book-covers)).
- Any other request that leaves the origin under test, and any URL on the
  mocked hosts that the index does not list, is **aborted** and reported by
  the `network` gate under the rule `unmocked`, naming the URL. So a journey
  that would have reached the real network fails instead.
- Same-origin traffic (the bundle, assets) is never intercepted.
- Covers are routed on their own pattern (`COVERS_URL_PATTERN`, plus
  `books.google.com/**`), separately from the API handler, so a journey that
  wants the real covers can still `unroute(COVERS_URL_PATTERN)` (the `live`
  suite does) and those requests then go to the network.

`index.json` is `{ "routes": [ ... ] }`; each entry is:

| Field | Required | Meaning |
|---|---|---|
| `url` | yes | The https URL. Query parameters match in any order; `*` matches any characters (exact entries win over patterns) |
| `body` | no | Body file, relative to the index |
| `status` | no | Default 200 |
| `contentType` | no | Default from the body file's extension (`.json`, `.html`, `.txt`, `.jpg`, `.png`) |
| `expected` | for status ≥ 400 | A deliberate error response (the 404 for an unknown ISBN, the 500 in the partial-failure journey). The network and console gates skip it, the way they skip `__expected-404` URLs; any other status ≥ 400 still fails them |
| `note` | no | What the fixture is, for the reader |

The index is validated before a browser starts: unknown fields, hosts that are
not mocked, missing or invalid body files, duplicate URLs and an error status
without `expected` are rejected. The Jest fixture tables
(`openLibraryRoutes.ts`, `googleBooksRoutes.ts`) serve the same files, and a
Jest test (`mockIndex.test.ts`) keeps every Jest route in the index with the
same status and body.

Record a new fixture by hand (never in CI) with
`node scripts/record-fixture.mjs <url> [<url> ...] [--name <file>] [--expected]`:
it sends the app's User-Agent, one request at a time at most once a second,
follows redirects, writes the body under the fixture directory and adds the
entry to `index.json`. `--dry-run` prints the entry without writing.

### Book covers

Every page the suite opens routes `https://covers.openlibrary.org/**` (unless
the mock index has an entry for the URL) to two synthetic JPEGs in `src/browser/fixtures/` (`src/browser/covers.ts`): a 2:3
test cover, and a white-padded square for the ids in `PADDED_COVER_IDS` (some
Open Library scans are padded like that). A URL with the expected-missing
marker gets what Open Library really sends for a cover it does not have:
`200 OK` with a transparent 1x1 GIF, or a `404` when the URL asks for
`default=false`. So the demo fixture's real cover URLs render real images
offline and deterministically. The images are plain shapes, not cover art;
`makeTestCovers.ts` next to them regenerates them.

**The `live` suite** is the exception: its journeys call
`context.unroute()` on the covers host, so the demo books load their real
covers from covers.openlibrary.org, and fail if any book that has a cover
shows a stand-in (a real cover is at least 400px tall; the stand-ins are at
most 300px) or the generated fallback. It needs the internet, so the per-push
CI leaves it out (`--exclude-suite live`); `.github/workflows/live.yml` runs
it weekly and uploads the screenshots. Run it by hand with
`npm run -s autotest -- journey --suite live --ux-gates fail`.

| Journey | Suite | Checks |
|---|---|---|
| `live-covers-detail` | live | Good Omens, Dune, The Colour of Magic and Pride and Prejudice each show a real portrait cover on book detail; a screenshot per book |
| `live-covers-shelf` | live | Every demo book with a cover shows a real one in the list and the covers grid; only The Farthest Shore (no cover) and The Murder of Roger Ackroyd (Open Library's 1x1 "no cover" GIF) show the generated cover; screenshots of the list, the grid while loading, and the settled grid |

### Waivers

A journey can downgrade one rule for itself only:

```ts
c.gates.waive('a11y', 'one-main', 'a third-party screen the app does not own has no main landmark');
```

The finding is still recorded in `uxgates.json`, as a warning prefixed with the
reason, and the waiver is listed at the top of the file. Use it for screens the
app does not own; fix the app instead where you can. No journey needs one
today.

### Serving the export

`--serve <dir>` starts an in-process static server (`src/server/static.ts`,
on `node:http`) before the command and stops it afterwards. It behaves like a
production host rather than the dev server:

- A path whose last segment has no extension (`/scan`, `/missing-shelf__expected-404`)
  falls back to `index.html`, so Expo Router handles routing (`web.output: "single"`).
- A path that looks like a file and is missing is a **real 404**, so a broken
  asset reference shows up in `network.json` and fails the network gate.
- Every response carries `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: credentialless` (the values `metro.config.js`
  sends), so the page is cross-origin isolated and expo-sqlite gets
  `SharedArrayBuffer`; `.wasm` is served as `application/wasm`.
- Only `GET`/`HEAD`; paths that escape the directory (`..`, encoded or not)
  are refused; responses are `Cache-Control: no-store`.
- The directory must contain `index.html`, or the command fails before a
  browser starts.

Re-export after changing app code: `--serve` tests whatever is in `dist/`.

### Dev-server caveats

- The Expo dev server answers **every unknown path with `200 text/html`** (the
  SPA shell). A missing static file therefore never shows up as a 404 in
  `network.json`; a missing `<img>` is caught by the render gate's `images`
  rule instead, and any link-checking journey must check the content type as
  well as the status. `/assets/?unstable_path=.%2Fmissing.png` is a path that
  really 404s.
- Unknown routes render the app's not-found screen with HTTP 200.

## Journeys

| Name | Suite | Checks |
|---|---|---|
| `home-loads` | core | `home-title` is an `<h1>` "MyShelf" inside the single main landmark, computed `font-weight: 700`, not the default serif; document title |
| `not-found` | core | `/missing-shelf__expected-404` renders the app's not-found screen: its title is the `<h1>` "Page not found" inside `main`, and the URL does not change |
| `tabs-navigate` | core | Clicking each tab (`Testids.tabs.*`) lands on its route with exactly one visible h1 naming the screen; `aria-selected="true"` on the active tab only (the web tab bar sets no `aria-current`); the page gates run on every tab screen; Booky is visible in the empty Shelf; one screenshot per tab |
| `booky-empty-shelf` | core | Booky (`booky-avatar`, role img, "Booky..." label) is in the empty Shelf's `empty-state`; "What can Booky do?" opens `booky-bubble` with non-empty `booky-bubble-text`; the page gates run again with the bubble open (dismiss button included); `booky-dismiss` closes it; screenshot `booky-tip-open.png` |
| `theme-tokens` | p00 | `--ms-color-primary` on `:root` is `#6B3FA8`; the computed body background equals `--ms-color-paper` and the body font starts with `--ms-font-body` |
| `shelf-empty` | core | Fixture `empty`: `empty-state` with Booky (`booky-avatar`), its title and message, the Scan and Add manually actions, no rows and no search box; screenshot `shelf-empty.png` |
| `shelf-demo-list` | core | Fixture `demo`: 12 `home-row`s, each a button named "Title, by Author, Year" (Dune's adds "on loan to Sam"), the "12 books catalogued" stamp and a polite live result count; the first rows show real cover images (loaded, no fallback) and the book without a cover shows the generated one; screenshot `shelf-demo.png` |
| `book-add-manual` | core | Fixture `empty`: Add manually, type title, author (Enter), year and genre (Enter), save; the detail page shows title, author, call number `FIC TOL 1937` and genre with a "Saved" snackbar (page gates run there); Back lists one row |
| `shelf-search-sort` | p01 | Search "prat" leaves Pratchett's 4 books and announces "4 of 12 books match “prat”"; clear restores 12; the sort button reports `aria-expanded`, Year is checked and re-orders the list, and the order survives a reload |
| `book-add-invalid-isbn` | p01 | ISBN `9780000000000` blocks saving: `book-form-error` is `role="alert"` and names ISBN, the field is `aria-invalid` and focused, the form stays open |
| `book-edit` | p01 | Fixture `demo`: first book → Edit (year field holds 1983) → 1984 → save → the detail page shows `FIC PRA 1984` and "Saved your changes" |
| `book-delete-undo` | p01 | Fixture `demo`: Dune → More (`role="menu"`) → Delete → `alertdialog` naming the book and its loan, with focus inside → Remove → 11 rows and an Undo snackbar (page gates run) → Undo → 12 rows, Dune still on loan |
| `book-covers` | p01 | Fixture `demo`: Pride and Prejudice's white-padded scan renders whole (`naturalWidth` 300, `object-fit: contain`, no fallback); The Murder of Roger Ackroyd's broken cover URL and The Farthest Shore's missing one show `cover-fallback`; Dune's real cover renders; the page gates run on the broken-cover page |
| `book-cover-pick` | p01 | Fixture `empty`: "Choose a photo" in the add form answered through the web file chooser with the synthetic test cover; the preview and the saved book's detail page show it as a real image, also after a reload |
| `book-form-discard` | p01 | A dirty form asks before leaving: Escape closes the dialog, keeps the text and returns focus to Cancel; Discard goes back to the empty Shelf |
| `book-detail-missing` | p01 | `/book/99999` shows `page-error` with the h1 "Book not found" and Booky; the `pagestate/error-marker` finding is waived because the error page is the point; Back to shelf goes to `/` |
| `loan-lend-return` | p05 | Fixture `demo`, today fixed: a home book → Lend (`role="dialog"`, today and today + 28 days filled in; saving without a borrower shows the error) → "sam" → Add → "Sam already exists — use them?" → Use Sam, due 29 Jun, note (page gates run on the sheet) → stamp "ON LOAN · SAM · DUE 29 JUN", "Lent to Sam", Mark returned instead of Lend → Loans tab: 3 rows, overdue first → Mark returned on the row (sheet gates) → "Welcome home" → History first row "RETURNED 15 JUN" → Undo puts it back out; screenshots `lend-sheet.png`, `lent.png`, `return-sheet.png`, `loans-history.png` |
| `loan-double-lend-blocked` | p05 | Dune (on loan) has Mark returned and no Lend, with its loan summary |
| `loans-overview` | p05 | Fixture `demo`, today fixed: `/loans` lists Roger Ackroyd ("OVERDUE · 5 DAYS", read out as "Overdue by 5 days…") then Dune ("DUE 26 JUN"); the Loans tab is named "Loans, 1 overdue" with a 1 badge; History has Mort (page gates run); the borrower filter narrows to Sam; the overdue book's page stamps "ON LOAN · PRIYA · OVERDUE · 5 DAYS"; screenshots `loans-tab.png`, `overdue-book.png` |
| `borrower-detail` | p05 | Sam from Dune's loan row → `/borrower/<id>`: h1 Sam, Dune under Currently has, Mort under Has borrowed before, stats line; Remove shows a `role="alert"` explaining Sam still has a book, and no dialog; screenshot `borrower-detail.png` |
| `loans-empty` | p05 | Fixture `empty`: `/loans` shows sleepy Booky and "Every book is home. Lovely." with no rows; screenshot `loans-empty.png` |
| `shelf-loan-badge` | p05 | Fixture `demo`, today fixed: only Dune ("on loan to Sam") and Roger Ackroyd ("on loan to Priya, overdue") are named as on loan, stamped ON LOAN and OVERDUE; screenshot `shelf-loan-badges.png` |
| `loan-overdue-nudge` | p05 | Fixture `demo`, then a restart: Booky (concerned) says "“The Murder of Roger Ackroyd” was due back from Priya 5 days ago." (page gates run with the bubble open) → Open loans → `/loans`; a second restart the same day shows no nudge; screenshot `overdue-nudge.png` |
| `home-responsive` | responsive | Viewport meta has `width=device-width, initial-scale=1`; at mobile, tablet and desktop the title is fully on screen and the page does not scroll sideways; one screenshot per width |
| `lookup-isbn-found` | core | Fixture `empty`: `/book/new` → look up ISBN 9780552166591 (mocked APIs) → one candidate card with its real cover → choose → title, year, ISBN, series, author and genre chips filled, real cover on the card → save → the detail page shows series and genre and the real cover (no fallback) |
| `lookup-isbn-not-found` | p02 | An ISBN Open Library 404s (fixture marked `expected`) → Booky's "couldn’t find that one" → Add it by hand keeps the ISBN and focuses the title |
| `lookup-search-title` | p02 | Search online "colour of magic pratchett" → The Colour of Magic first, with a real cover |
| `lookup-provider-partial-failure` | p02 | Google Books answers 500 (marked `expected`, retried three times) → the Open Library result still shows with a note, no error state |
| `cover-backfill-mocked` | p02 | A book typed in with an ISBN and no cover → restart → the tab shell's cover backfill looks it up through the mock and the Shelf row shows its real cover |
| `book-refresh-diff` | p02 | Fixture `demo`: The Farthest Shore → More → Refresh details → checkbox rows ("Summary: add" ticked, "Pages: 223 → 214" not) → keep only the summary → Update 1 detail → the summary shows, the other facts are unchanged |
| `scan-web-isbn-single` | core | Fixture `empty`: `/scan` → type ISBN 9780552166591 → the picker shows the one edition pre-selected with a real cover → This is my edition → the book page with its real cover and Booky’s visible "Shelved! That’s 1 book." |
| `scan-web-cover-text` | p03 | Cover mode → type "THE COLOUR OF MAGIC TERRY PRATCHETT" → works grouped → open the first (`aria-expanded`) → filter to paperbacks → choose the 1990 Corgi → saved with series Discworld, book 1, the Corgi facts and a real cover |
| `scan-not-found-manual` | p03 | An unknown ISBN → Booky's not-found bubble → Add it by hand → the form holds the ISBN, nothing saved |
| `scan-duplicate` | p03 | Fixture `demo`: scan Pride and Prejudice’s ISBN → "Already on your shelf" sheet (`role="dialog"`) → Add another copy → 13 rows |
| `scan-batch-review` | p03 | Scan several: 3 ISBNs → tray count 3 → Review → drop one → Save 2 books → 2 rows on the Shelf, tray empty |
| `scan-e2e-inject` | p03 | `/e2e/scan?isbn=9780553418026` hands the scan to the Scan tab → the picker shows The Martian |

### Adding a journey

1. Add any new `data-testid` to `src/testing/selectors.json` and run
   `npm run selectors:gen`. The app uses `Testids.group.key`; journeys import
   the same `Testids` from `src/selectors.ts` and build the CSS selector with
   `tid(Testids.group.key)` — never type a testid string twice.
   `npm run selectors:check` (part of `npm run check` and CI) fails on drift.
2. Create or extend a `src/journeys/<area>.journey.ts` file. Every
   `*.journey.ts` file is imported at startup, so there is no list to update:

   ```ts
   import { Testids, tid } from '../selectors.ts';
   import { expect, q, register } from './registry.ts';

   register({
     name: 'shelf-add-book',
     suite: 'core',
     desc: 'Adding a book shows it on the shelf with aria-selected on the Shelf tab',
     async run(c) {
       await c.goto('/shelf'); // pagestate + render + a11y
       // ... interact via tid(Testids.x.y) ...
       const got = await c.page.locator(tid(Testids.shelf.firstTitle)).innerText();
       expect(got === 'Dune', `/shelf: expected first book ${q('Dune')}, found ${q(got)}`);
     },
   });
   ```

   - Names are unique; a duplicate throws at startup.
   - `expect` messages must say what was expected and what was found; `q()`
     quotes a value.
   - Wait on conditions (`locator.waitFor`, `expect` on state), not clocks.
   - `c.checkGates('/where')` runs the page gates on a screen reached by a
     click rather than by `c.goto`.
   - Use `c.snap('name')` for extra screenshots in the run directory.
   - Console and network gates run automatically at the end.
   - Prefer checks that a screenshot cannot show: keyboard contracts, ARIA
     state matching visual state, persistence across reload, responsive
     behaviour, links that resolve.
3. `npm run -s autotest -- journey --list`, then run it with `--ux-gates fail`.
4. Put fast, essential journeys in `core` (run by `smoke` in CI).

## CI

`.github/workflows/ci.yml` has three jobs:

- **App checks**: `npm ci`, `npm run check` (selector drift check, lint,
  typecheck, Jest).
- **Commit messages**: runs `.githooks/commit-msg` on every commit in the pull
  request or pushed range (`scripts/check-commit-messages.sh`).
- **auto-test-suite smoke**: `npm ci`, install Chromium with its system
  dependencies (the browser download is cached per Playwright version),
  `npm run autotest:check`, the gate self-tests (`npm run autotest:selftest`),
  start the Expo dev server just long enough to
  write Expo Router's typed routes (`.expo/types/router.d.ts`; `expo export`
  does not generate them) and stop it, run `npm run typecheck` again (now
  strict about route links), `npm run export:web`, then against `--serve dist`
  with `--ux-gates fail` run `smoke` (so a core failure is reported first)
  and `journey --all --exclude-suite core` (every other suite, so a journey
  in a new suite runs without a workflow change), and upload
  `screenshots/` plus the Expo logs as an artifact when anything fails.

  Why the export and not the dev server: it is the bundle that ships, missing
  assets are real 404s, and there is no lazy Metro bundling inside the first
  journey. Measured locally with cold caches (`--clear`), four journeys: dev
  server 1.2 s to start + 5.7 s of journeys (the first one waits 2.7 s for
  Metro); export 4.5 s + 2.9 s of journeys. About the same today; the export
  pays its cost once while the dev server's per-journey cost grows with the
  suite.

## Proving the gates fire

A gate that has never failed is decoration. `npm run autotest:selftest`
(`src/uxgates/selftest/gates.selftest.ts`, Node's test runner, about 7 s)
proves every rule fires:

- `selftest/fixtures.ts` builds one **clean** page that every gate accepts
  (with every rule on, `skip-link` included) and one variant per rule that
  breaks exactly that rule: two h1s, a heading skip, an image that does not
  decode, a 3000 px wide element, a 30 × 30 button, a missing token, no
  stylesheet, a `console.error`, an uncaught exception, a fetch that 404s, a
  fetch to a port nothing listens on, a missing content marker, and so on.
  A second clean page requests an `__expected-404` URL to prove that
  exemption.
- The test writes the pages to a temporary directory, serves them with the
  `--serve` static server, opens each in a fresh Chromium context and runs
  the same `checkPage` / `checkTraffic` calls a journey uses (render at mobile
  and desktop) with its own gates config (`selfTestConfig`).
- For each page it asserts the **exact** set of error findings (`gate/rule`):
  a rule that stops firing fails its page, and so does a page that
  accidentally breaks a second rule. It also checks every gate ran (only
  console and network after a failed pagestate).
- A coverage test fails when a rule id in `RenderRules` or `A11yRules`, or a
  pagestate, console or network rule, has no page that fires it. **A new rule
  needs a fixture.**
- The network pages also fire `console/error`: Chromium logs every failed
  resource load as a console error.
- Without Chromium the browser tests are skipped with a message; under `CI`
  a missing browser fails instead. CI runs the self-tests right after
  installing Chromium.

Proof that the proof works: with the network gate's check short-circuited
and the `stylesheets` check removed, the run fails `render-stylesheets`,
`network-http-status` and `network-request-failed`; with `target-size`
disabled in the self-test config it fails both target-size pages.

### The `stylesheets` rule

It has never fired against the app, and it cannot: `public/index.html`
carries an inline reset `<style>`, and react-native-web injects its own
stylesheet, so a page that got as far as the render gate always has readable
rules. (If the bundle never runs, pagestate fails first and render is
skipped.) The `render-stylesheets` fixture proves the check itself works. It
stays on as a cheap guard for a page served without that template, for
example if the app moves to `web.output: "static"`, where
`src/app/+html.tsx` replaces `public/index.html`.
