# auto-test-suite

Browser automation for the MyShelf web build (Expo Router + React Native Web),
written in Go with Cobra and playwright-go.

It is an **evidence generator that also fails**. Every browser command leaves a
bundle behind — screenshot, rendered DOM, console log, failed network requests
and gate results — in a fresh directory, prints one JSON document on stdout and
exits non-zero when something is wrong. The exit code is a convenience; the
bundle is the product.

```
tools/auto-test-suite/
├── main.go
├── go.mod                       module github.com/asorichetti/MyShelf/tools/auto-test-suite
└── internal/
    ├── cmd/                     root flags, navigate, journey, smoke, screenshot, interact
    ├── browser/                 Chromium lifecycle, listeners, run bundle
    ├── uxgates/                 pagestate, render, console, network, a11y
    │   ├── gates.config.json    render/a11y configuration (embedded)
    │   └── console_allowlist.json
    ├── selectors/               selectors.gen.go (generated, do not edit)
    └── journeys/                registry + one file per area
```

## Setup

Requirements: Go (version in `go.mod`), Node + npm (for the app).

```bash
npm ci                          # app dependencies
npm run autotest:install-browser      # one time: Playwright driver + Chromium
npm run autotest:build                # -> tools/auto-test-suite/bin/auto-test-suite
```

Start the app's web server in another terminal:

```bash
CI=1 npx expo start --web --port 8081
```

`CI=1` turns off Metro's file watcher. **After adding or renaming a route,
restart the server**; otherwise the new route renders the not-found screen and
the pagestate gate (correctly) fails.

Then:

```bash
npm run -s autotest:smoke                          # core suite, gates=fail, headless
npm run -s autotest:journeys                       # every journey (gates=warn unless you pass --ux-gates)
npm run -s autotest:journeys -- --ux-gates fail    # extra flags go after --
npm run autotest:check                             # gofmt, go vet, go test
```

Use `npm run -s` when you want to parse stdout: without `-s`, npm prints its
own banner lines on stdout before the JSON.

All Go commands run with `GOWORK=off` in scripts and CI, so a `go.work` added
above the repo later cannot change the build.

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

Some journeys add named screenshots (e.g. `home-mobile.png`). The bundle is
written through a `defer`, and `Close()` writes it as a last resort if nothing
else did, so failed runs — the ones you need evidence for — always have one.
Run directories are timestamped and never overwritten. `/screenshots/` and
`/tools/auto-test-suite/screenshots/` are gitignored.

## Output contract

- **stdout** is exactly one JSON document per invocation, including on errors
  (`{"command": ..., "ok": false, "error": ...}` for bad flags or an unknown
  journey).
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
  "total": 2, "passed": 2, "failed": 0,
  "results": [
    {
      "name": "home-loads", "suite": "core", "ok": true, "durationMs": 1243,
      "gates": {"mode": "fail", "failed": false, "results": 6, "findings": 0, "findingsByGate": {}},
      "artifacts": {
        "runDir": ".../screenshots/journey-home-loads-1790384924802",
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
`"render/overflow [/broken @mobile]: content overflows sideways at 390px: div[data-testid=\"too-wide\"] (right=3000px)"`.

## Global flags

| Flag | Default | Notes |
|---|---|---|
| `--env` | `local` | `local` = `http://localhost:8081`. There is no preview environment yet |
| `--base-url` | | Overrides `--env` (e.g. a server on another port) |
| `--headless` | computed | `true` when `CI` is set; `false` when `DISPLAY`/`WAYLAND_DISPLAY` is set; otherwise `false` on macOS and `true` elsewhere (containers have no display) |
| `--screenshot-dir` | `./screenshots` | Parent directory for run bundles, relative to the current directory |
| `--ux-gates` | `warn` | `off` (skip gates), `warn` (record findings, do not fail), `fail` |
| `--viewport` | `mobile` | `mobile` 390x844, `tablet` 820x1180, `desktop` 1280x900. `AUTOTEST_VIEWPORT_HEIGHT` overrides the height |
| `--color-scheme` | browser default | `light`, `dark`, `no-preference` |
| `--gates-config` | embedded | Path to an alternative `gates.config.json` |
| `--console-allowlist` | embedded | Path to an alternative `console_allowlist.json` |

The default viewport is `mobile` because MyShelf is a phone app rendered on the
web; `desktop` exists to exercise layout from the other side.

## Commands

### `navigate`

Open a page, wait for the content marker, run all gates, capture a bundle.

```bash
auto-test-suite navigate --url /
auto-test-suite navigate --url / --wait 2000 --ux-gates fail
auto-test-suite navigate --url /somewhere --marker '[data-testid="expo-router-unmatched"]'
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
auto-test-suite journey --grep home            # regexp over name and description
auto-test-suite journey --all
```

`--list` combines with `--suite`/`--grep` to preview a selection. Each journey
runs in a **fresh browser, page and run directory**.

### `smoke`

`journey --suite core` with `--ux-gates fail` and `--headless=true`. Either
default is only applied when you did not pass that flag yourself. This is what
CI runs.

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

The render gate runs at each combination's own viewport.

### `interact`

One action, for poking at a page. Anything worth checking twice becomes a
journey.

```bash
auto-test-suite interact click --url / --testid home-title
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
(`aria-selected`, `aria-expanded`, `aria-current`, ...).

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
| `pagestate` | The content marker (`page-content` testid, or `--marker`) is not visible within 15 s; the `page-error` testid is visible; or the visible `main` has fewer than 10 characters of text |
| `render` | The page rendered but is not styled (rules below) |
| `console` | A console error or uncaught exception that is not allowlisted |
| `network` | Any response >= 400 or request that got no response |
| `a11y` | Structural accessibility regressions (rules below) |

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
| `images` | An `<img>` is not `complete` with `naturalWidth > 0` |
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

The gate does not judge whether alt text is useful or focus order is sensible;
that needs a human.

### Configuration: `internal/uxgates/gates.config.json`

```json
{
  "render": { "requiredTokens": [], "landmarks": ["main"], "disabled": { "<rule>": "<reason>" } },
  "a11y":   { "disabled": { "<rule>": "<reason>" } }
}
```

The file is embedded in the binary; `--gates-config` points at another copy.
Unknown rule ids and disabled rules without a reason are rejected at startup.
Disabled rules are listed under `skipped` in every result in `uxgates.json`.

Current decisions for this app:

| Rule | State | Why |
|---|---|---|
| a11y `skip-link` | off | MyShelf is a mobile app rendered with react-native-web: there is no repeated header/nav block before the content, and a skip link has no native iOS/Android equivalent |
| render `landmarks` | `main` only | Header and footer landmarks are optional in a mobile app shell |
| render `requiredTokens` | empty | The `--ms-*` design tokens on `:root` are being added; list them here once they exist |
| render `body-background` | off, **temporary** | The placeholder app has no web document shell: `<body>` keeps a transparent background. Re-enable when the app shell sets it |
| render `body-font` | off, **temporary** | Same cause: `<body>` computes to Times because only react-native-web Text gets the system font stack. `text-font` still checks real text in `main` |
| render `fonts-loaded` | off, **temporary** | The app uses the platform system font stack and declares no web font, so `document.fonts` is empty by design. `fonts-error` still runs |

The three temporary exemptions were found by the render gate on the first run
against the placeholder home screen. They are expected to be fixed by the app
shell work (body background and font from the design tokens, a web font via
expo-font if one is chosen); remove the entries then.

### Console allowlist: `internal/uxgates/console_allowlist.json`

```json
[{ "pattern": "<Go regexp>", "reason": "<why this error is acceptable>" }]
```

Both fields are required. Keep patterns narrow: one broad pattern added to fix
one journey buries the next real bug. It is currently empty.

### Deliberately missing URLs

A journey that tests the not-found screen requests a missing route on purpose.
Do **not** allowlist 404s for it. Put `uxgates.ExpectedMissingMarker`
(`__expected-404`) in the URL instead; the console and network gates both skip
URLs and messages containing it, and nothing else.

### Waivers

A journey can downgrade one rule for itself only:

```go
c.Gates.Waive("a11y", "one-main", "Expo Router's built-in not-found screen has no main landmark")
```

The finding is still recorded in `uxgates.json`, as a warning prefixed with the
reason, and the waiver is listed at the top of the file. Use it for screens the
app does not own; fix the app instead where you can.

### Dev-server caveats

- The Expo dev server answers **every unknown path with `200 text/html`** (the
  SPA shell). A missing static file therefore never shows up as a 404 in
  `network.json`; a missing `<img>` is caught by the render gate's `images`
  rule instead, and any link-checking journey must check the content type as
  well as the status.
- Unknown routes render Expo Router's built-in not-found screen with HTTP 200.

## Journeys

| Name | Suite | Checks |
|---|---|---|
| `home-loads` | core | `home-title` is an `<h1>` "MyShelf" inside the single main landmark, computed `font-weight: 700`, not the default serif; document title |
| `not-found` | core | `/missing-shelf__expected-404` renders the not-found screen (h1 "Unmatched Route") and stays on that URL |
| `home-responsive` | responsive | Viewport meta has `width=device-width, initial-scale=1`; at mobile, tablet and desktop the title is fully on screen and the page does not scroll sideways; one screenshot per width |

### Adding a journey

1. Add any new `data-testid` to `src/testing/selectors.json` and run
   `npm run selectors:gen`. Use `Testids.group.key` in the app and
   `selectors.Group.Key` in Go — never type a testid string twice.
   `npm run selectors:check` (part of `npm run check` and CI) fails on drift.
2. Create or extend a file in `internal/journeys/` (one file per area):

   ```go
   func init() {
       register(Journey{
           Name:  "shelf-add-book",
           Suite: "core",
           Desc:  "Adding a book shows it on the shelf with aria-selected on the Shelf tab",
           Run: func(c *Context) error {
               if err := c.Goto("/shelf"); err != nil { // pagestate + render + a11y
                   return err
               }
               // ... interact via selectors.X.Y ...
               got, err := c.Page.Locator(selectors.Shelf.Title).InnerText()
               if err != nil {
                   return err
               }
               return expect(got == "Dune", "/shelf: expected first book %q, found %q", "Dune", got)
           },
       })
   }
   ```

   - Names are unique; a duplicate panics at startup.
   - `expect` messages must say what was expected and what was found.
   - Wait on conditions (`Locator.WaitFor`, `expect` on state), not clocks.
   - Use `c.Snap("name")` for extra screenshots in the run directory.
   - Console and network gates run automatically at the end.
   - Prefer checks that a screenshot cannot show: keyboard contracts, ARIA
     state matching visual state, persistence across reload, responsive
     behaviour, links that resolve.
3. `npm run autotest:build && tools/auto-test-suite/bin/auto-test-suite journey --list`, then run it
   with `--ux-gates fail`.
4. Put fast, essential journeys in `core` (run by `smoke` in CI).

## CI

`.github/workflows/ci.yml` has two jobs:

- **App checks**: `npm ci`, `npm run check` (selector drift check, typecheck,
  Jest).
- **auto-test-suite smoke**: gofmt, `go vet`, `go test`, `go build`, install Chromium
  with system dependencies, start the Expo web server on 8081, run `smoke` and
  the `responsive` suite with `--ux-gates fail`, and upload `screenshots/` plus
  the Expo log as an artifact when anything fails.

## Proving the gates fire

A gate that has never failed is decoration. When changing a gate, or before
trusting a new one:

1. Add a temporary route (never commit it) with a valid content marker and
   enough text in `main`, plus: two h1s, a heading skip, an `<img>` without alt
   pointing at a missing file, an unnamed `role="button"`, an unlabelled
   navigation, a 3000px-wide element, a `console.error`, and a `fetch` to a URL
   that really 404s (on the dev server: `/assets/?unstable_path=.%2Fmissing.png`)
   and one that never connects.
2. Restart the Expo server (watch mode is off), then
   `auto-test-suite navigate --url /that-route --wait 2000 --ux-gates warn`.
3. For pagestate, run the same route with `--marker '[data-testid="never-rendered"]'`
   (and a variant with under 10 characters of text in `main`).
4. Confirm findings from all five gates, delete the route and the run
   directories, and re-run the real suite with `--ux-gates fail`.
