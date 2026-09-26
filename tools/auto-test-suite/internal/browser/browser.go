// Package browser owns the Chromium lifecycle, the event listeners that
// capture console/network evidence, and the per-run debug bundle.
package browser

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"

	"github.com/mxschmitt/playwright-go"
)

// Viewport presets. The app is a React Native Web mobile app, so the CLI
// defaults to "mobile"; desktop and tablet exist to exercise layouts from both
// sides of a media query.
var Viewports = map[string]playwright.Size{
	"mobile":  {Width: 390, Height: 844},
	"tablet":  {Width: 820, Height: 1180},
	"desktop": {Width: 1280, Height: 900},
}

// ViewportHeightEnv overrides the preset height, e.g. to render a tall scroll
// container in one full-page screenshot.
const ViewportHeightEnv = "AUTOTEST_VIEWPORT_HEIGHT"

// ViewportNames returns the preset names in a stable order.
func ViewportNames() []string {
	names := make([]string, 0, len(Viewports))
	for n := range Viewports {
		names = append(names, n)
	}
	sort.Strings(names)
	return names
}

// ResolveViewport maps a preset name to a size, applying ViewportHeightEnv.
func ResolveViewport(name string) (playwright.Size, error) {
	vp, ok := Viewports[strings.ToLower(strings.TrimSpace(name))]
	if !ok {
		return playwright.Size{}, fmt.Errorf("unknown viewport %q (want one of %s)", name, strings.Join(ViewportNames(), ", "))
	}
	if h := os.Getenv(ViewportHeightEnv); h != "" {
		n, err := strconv.Atoi(h)
		if err != nil || n <= 0 {
			return playwright.Size{}, fmt.Errorf("%s=%q is not a positive integer", ViewportHeightEnv, h)
		}
		vp.Height = n
	}
	return vp, nil
}

// ViewportName returns the preset name for a size, or WxH when it is custom.
func ViewportName(vp playwright.Size) string {
	for _, n := range ViewportNames() {
		if Viewports[n].Width == vp.Width {
			return n
		}
	}
	return fmt.Sprintf("%dx%d", vp.Width, vp.Height)
}

// DefaultHeadless decides headless mode from display presence rather than from
// CI alone: containers have no display either, and a headed launch there fails
// in a way that looks like a bad flag.
func DefaultHeadless() bool {
	if os.Getenv("CI") != "" {
		return true
	}
	if os.Getenv("DISPLAY") != "" || os.Getenv("WAYLAND_DISPLAY") != "" {
		return false
	}
	return runtime.GOOS != "darwin" // macOS draws via Quartz and sets neither
}

// Browser is one Playwright driver plus one Chromium process.
type Browser struct {
	pw      *playwright.Playwright
	browser playwright.Browser
	ctxs    []playwright.BrowserContext
}

// New starts the Playwright driver and launches Chromium.
func New(headless bool) (*Browser, error) {
	pw, err := playwright.Run(&playwright.RunOptions{
		SkipInstallBrowsers: true,
		Verbose:             false,
		Stdout:              os.Stderr, // stdout is reserved for the JSON result
		Stderr:              os.Stderr,
	})
	if err != nil {
		return nil, fmt.Errorf("start playwright (install with `go run github.com/mxschmitt/playwright-go/cmd/playwright install chromium`): %w", err)
	}
	b, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(headless),
		// Chromium keeps renderer shared memory in /dev/shm, which containers
		// cap at 64M; overrunning it crashes the tab before any step runs.
		Args: []string{"--disable-dev-shm-usage"},
	})
	if err != nil {
		_ = pw.Stop()
		return nil, fmt.Errorf("launch chromium (headless=%v): %w", headless, err)
	}
	return &Browser{pw: pw, browser: b}, nil
}

// NewPage opens a page in a fresh context. A page's colour scheme is fixed at
// creation, so capturing light and dark needs one page per scheme.
func (b *Browser) NewPage(viewport playwright.Size, colorScheme string) (playwright.Page, error) {
	opts := playwright.BrowserNewContextOptions{
		Viewport: &playwright.Size{Width: viewport.Width, Height: viewport.Height},
		Locale:   playwright.String("en-US"),
	}
	switch strings.ToLower(colorScheme) {
	case "":
	case "light":
		opts.ColorScheme = playwright.ColorSchemeLight
	case "dark":
		opts.ColorScheme = playwright.ColorSchemeDark
	case "no-preference":
		opts.ColorScheme = playwright.ColorSchemeNoPreference
	default:
		return nil, fmt.Errorf("unknown color scheme %q (want light, dark or no-preference)", colorScheme)
	}
	ctx, err := b.browser.NewContext(opts)
	if err != nil {
		return nil, fmt.Errorf("new browser context: %w", err)
	}
	b.ctxs = append(b.ctxs, ctx)
	page, err := ctx.NewPage()
	if err != nil {
		return nil, fmt.Errorf("new page: %w", err)
	}
	return page, nil
}

// Screenshot writes a full-page PNG. When outPath is empty it goes to
// dir/screenshot.png. Returns the path written.
func Screenshot(page playwright.Page, outPath, dir string) (string, error) {
	if outPath == "" {
		outPath = filepath.Join(dir, "screenshot.png")
	}
	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		return "", err
	}
	if _, err := page.Screenshot(playwright.PageScreenshotOptions{
		Path:     playwright.String(outPath),
		FullPage: playwright.Bool(true),
	}); err != nil {
		return "", fmt.Errorf("screenshot: %w", err)
	}
	return outPath, nil
}

// Close tears everything down. It logs instead of returning errors so it is
// safe to defer.
func (b *Browser) Close() {
	if b == nil {
		return
	}
	for _, c := range b.ctxs {
		if err := c.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "browser: close context: %v\n", err)
		}
	}
	b.ctxs = nil
	if b.browser != nil {
		if err := b.browser.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "browser: close chromium: %v\n", err)
		}
		b.browser = nil
	}
	if b.pw != nil {
		if err := b.pw.Stop(); err != nil {
			fmt.Fprintf(os.Stderr, "browser: stop playwright: %v\n", err)
		}
		b.pw = nil
	}
}
