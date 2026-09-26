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

var interactOpts struct {
	url      string
	selector string
	testid   string
	value    string
	key      string
	marker   string
	settle   int
}

type interactResult struct {
	Command    string            `json:"command"`
	OK         bool              `json:"ok"`
	Action     string            `json:"action"`
	URL        string            `json:"url"`
	Selector   string            `json:"selector,omitempty"`
	FinalURL   string            `json:"finalUrl,omitempty"`
	After      map[string]any    `json:"after,omitempty"`
	Error      string            `json:"error,omitempty"`
	DurationMs int64             `json:"durationMs"`
	Gates      uxgates.Summary   `json:"gates"`
	Failures   []string          `json:"gateFailures,omitempty"`
	Artifacts  browser.Artifacts `json:"artifacts"`
}

var interactCmd = &cobra.Command{
	Use:       "interact click|fill|press|focus",
	Short:     "Perform one action on a page and capture the result (anything worth checking twice becomes a journey)",
	Args:      cobra.MatchAll(cobra.ExactArgs(1), cobra.OnlyValidArgs),
	ValidArgs: []string{"click", "fill", "press", "focus"},
	Example: `  auto-test-suite interact click --url / --testid home-title
  auto-test-suite interact fill  --url /search --selector 'input[name=q]' --value dune
  auto-test-suite interact press --url / --key Tab
  auto-test-suite interact focus --url / --testid home-title`,
	RunE: func(cmd *cobra.Command, args []string) error {
		res, err := interact(args[0])
		if err != nil {
			res.Error = err.Error()
		}
		res.OK = err == nil
		emit(res)
		return err
	},
}

func init() {
	f := interactCmd.Flags()
	f.StringVar(&interactOpts.url, "url", "/", "page to open first")
	f.StringVar(&interactOpts.selector, "selector", "", "Playwright selector of the target element")
	f.StringVar(&interactOpts.testid, "testid", "", "data-testid of the target element (shorthand for --selector '[data-testid=\"...\"]')")
	f.StringVar(&interactOpts.value, "value", "", "text for fill")
	f.StringVar(&interactOpts.key, "key", "", "key for press, e.g. Tab, Enter, Escape, ArrowDown")
	f.StringVar(&interactOpts.marker, "marker", "", "selector that means the page rendered (default: the page-content testid)")
	f.IntVar(&interactOpts.settle, "settle", 300, "milliseconds to let the UI settle after the action")
	rootCmd.AddCommand(interactCmd)
}

func interact(action string) (res interactResult, err error) {
	start := time.Now()
	base, _ := baseURL()
	target := resolveURL(base, interactOpts.url)
	sel := interactOpts.selector
	if interactOpts.testid != "" {
		sel = fmt.Sprintf(`[data-testid="%s"]`, interactOpts.testid)
	}
	res = interactResult{Command: "interact", Action: action, URL: target, Selector: sel}
	switch action {
	case "click", "fill", "focus":
		if sel == "" {
			return res, fmt.Errorf("interact %s needs --selector or --testid", action)
		}
	case "press":
		if interactOpts.key == "" {
			return res, errors.New("interact press needs --key")
		}
	}
	rec := uxgates.NewRecorder(gateMode())
	vp := viewport()
	run, err := browser.NewRun("interact-"+action, g.headless, g.screenshotDir, vp, g.colorScheme)
	if err != nil {
		return res, err
	}
	run.Gates = rec
	defer func() {
		res.Artifacts = run.FinishOrLog()
		run.Close()
		res.Gates = rec.Summary()
		res.Failures = gateFailures(rec)
		res.DurationMs = time.Since(start).Milliseconds()
	}()
	if _, err := run.Page.Goto(target, playwright.PageGotoOptions{WaitUntil: playwright.WaitUntilStateLoad}); err != nil {
		return res, fmt.Errorf("goto %s: %w", target, err)
	}
	var errs []error
	errs = append(errs, uxgates.CheckPage(run.Page, rec, interactOpts.url, uxgates.PageStateOptions{Marker: interactOpts.marker}, []playwright.Size{vp}))
	if !rec.Enabled() && sel != "" {
		if werr := run.Page.Locator(sel).First().WaitFor(); werr != nil {
			return res, fmt.Errorf("%s never appeared: %w", sel, werr)
		}
	}
	loc := run.Page.Locator(sel).First()
	var aerr error
	switch action {
	case "click":
		aerr = loc.Click()
	case "fill":
		aerr = loc.Fill(interactOpts.value)
	case "focus":
		aerr = loc.Focus()
	case "press":
		if sel != "" {
			aerr = loc.Press(interactOpts.key)
		} else {
			aerr = run.Page.Keyboard().Press(interactOpts.key)
		}
	}
	if aerr != nil {
		return res, fmt.Errorf("%s %s: %w", action, sel, aerr)
	}
	if interactOpts.settle > 0 {
		// A short settle after an interaction is the one allowed fixed wait.
		run.Page.WaitForTimeout(float64(interactOpts.settle))
	}
	after := map[string]any{}
	if v, e := run.Page.Evaluate(`() => {
		const a = document.activeElement;
		if (!a || a === document.body) return {activeElement: 'body'};
		const attrs = {};
		for (const n of ['data-testid', 'role', 'aria-selected', 'aria-expanded', 'aria-current', 'aria-checked', 'aria-pressed']) {
			if (a.hasAttribute(n)) attrs[n] = a.getAttribute(n);
		}
		return {activeElement: a.tagName.toLowerCase(), attributes: attrs, text: (a.innerText || '').slice(0, 80)};
	}`); e == nil {
		after["focus"] = v
	}
	res.After = after
	res.FinalURL = run.Page.URL()
	errs = append(errs, uxgates.CheckTraffic(run.Listeners, rec, interactOpts.url))
	return res, errors.Join(errs...)
}
