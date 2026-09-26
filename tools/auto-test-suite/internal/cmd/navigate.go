package cmd

import (
	"errors"
	"fmt"
	"time"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/browser"
	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/uxgates"
	"github.com/mxschmitt/playwright-go"
	"github.com/spf13/cobra"
)

type navigateResult struct {
	Command     string            `json:"command"`
	OK          bool              `json:"ok"`
	URL         string            `json:"url"`
	FinalURL    string            `json:"finalUrl,omitempty"`
	Status      int               `json:"status,omitempty"`
	Title       string            `json:"title,omitempty"`
	Viewport    string            `json:"viewport"`
	ColorScheme string            `json:"colorScheme,omitempty"`
	DurationMs  int64             `json:"durationMs"`
	Error       string            `json:"error,omitempty"`
	Gates       uxgates.Summary   `json:"gates"`
	Failures    []string          `json:"gateFailures,omitempty"`
	Artifacts   browser.Artifacts `json:"artifacts"`
	Extra       map[string]any    `json:"extra,omitempty"`
}

var navigateOpts struct {
	url    string
	wait   int
	marker string
}

var navigateCmd = &cobra.Command{
	Use:   "navigate",
	Short: "Open a URL, wait for it to settle, run the gates and capture a bundle",
	Example: `  auto-test-suite navigate --url /
  auto-test-suite navigate --url /nope__expected-404 --marker 'text=Unmatched Route'
  auto-test-suite navigate --url / --wait 2000 --ux-gates fail`,
	RunE: func(cmd *cobra.Command, _ []string) error {
		res, err := navigateOnce("navigate", navigateOpts.url, viewport(), g.colorScheme, navigateOpts.marker, navigateOpts.wait)
		emit(res)
		return err
	},
}

func init() {
	f := navigateCmd.Flags()
	f.StringVar(&navigateOpts.url, "url", "/", "path (joined to the base URL) or absolute URL")
	f.IntVar(&navigateOpts.wait, "wait", 0, "extra milliseconds to wait after the content marker appears, so async requests land before the gates snapshot")
	f.StringVar(&navigateOpts.marker, "marker", "", "selector that means the page rendered (default: the page-content testid)")
	rootCmd.AddCommand(navigateCmd)
}

// navigateOnce is one fresh browser, one page, one bundle.
func navigateOnce(name, path string, vp playwright.Size, scheme, marker string, waitMs int) (res navigateResult, err error) {
	start := time.Now()
	base, _ := baseURL()
	target := resolveURL(base, path)
	rec := uxgates.NewRecorder(gateMode())
	res = navigateResult{Command: name, URL: target, Viewport: browser.ViewportName(vp), ColorScheme: scheme}

	run, err := browser.NewRun(name, g.headless, g.screenshotDir, vp, scheme)
	if err != nil {
		res.Error = err.Error()
		res.Gates = rec.Summary()
		return res, err
	}
	run.Gates = rec
	defer func() {
		res.Artifacts = run.FinishOrLog()
		run.Close()
		res.Gates = rec.Summary()
		res.Failures = gateFailures(rec)
		res.DurationMs = time.Since(start).Milliseconds()
		if err != nil {
			res.Error = err.Error()
		}
		res.OK = err == nil
		logf("%s %s -> ok=%v bundle=%s", name, target, res.OK, run.Dir)
	}()

	logf("%s %s (viewport %s, gates %s)", name, target, res.Viewport, rec.Mode())
	resp, gerr := run.Page.Goto(target, playwright.PageGotoOptions{WaitUntil: playwright.WaitUntilStateLoad})
	if gerr != nil {
		return res, fmt.Errorf("goto %s: %w", target, gerr)
	}
	if resp != nil {
		res.Status = resp.Status()
	}
	var errs []error
	errs = append(errs, uxgates.CheckPage(run.Page, rec, path, uxgates.PageStateOptions{Marker: marker}, renderViewports(vp)))
	if !rec.Enabled() && marker != "" {
		if werr := run.Page.Locator(marker).First().WaitFor(); werr != nil {
			errs = append(errs, fmt.Errorf("marker %s: %w", marker, werr))
		}
	}
	if waitMs > 0 {
		// Deliberate, documented: async work (a fetch in an effect) has not
		// landed when the content marker appears.
		run.Page.WaitForTimeout(float64(waitMs))
	}
	errs = append(errs, uxgates.CheckTraffic(run.Listeners, rec, path))
	res.FinalURL = run.Page.URL()
	res.Title, _ = run.Page.Title()
	return res, errors.Join(errs...)
}
