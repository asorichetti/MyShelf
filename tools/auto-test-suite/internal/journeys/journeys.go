// Package journeys is the self-registering journey registry and runner. Each
// journey gets a fresh browser, page and run directory.
package journeys

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime/debug"
	"sort"
	"strings"
	"time"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/browser"
	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/uxgates"
	"github.com/mxschmitt/playwright-go"
)

// Journey is one scripted user path with assertions.
type Journey struct {
	Name  string
	Suite string
	Desc  string
	Run   func(c *Context) error
}

var registry = map[string]Journey{}

// register adds a journey. A duplicate name can only come from a copy-paste,
// so it panics at init rather than reaching a run.
func register(j Journey) {
	if j.Name == "" || j.Suite == "" || j.Desc == "" || j.Run == nil {
		panic(fmt.Sprintf("journeys: incomplete journey %+v", j))
	}
	if _, dup := registry[j.Name]; dup {
		panic("journeys: duplicate journey name " + j.Name)
	}
	registry[j.Name] = j
}

// All returns every journey sorted by name, so runs are reproducible.
func All() []Journey {
	out := make([]Journey, 0, len(registry))
	for _, j := range registry {
		out = append(out, j)
	}
	sort.Slice(out, func(a, b int) bool { return out[a].Name < out[b].Name })
	return out
}

// Get returns one journey by name.
func Get(name string) (Journey, bool) {
	j, ok := registry[name]
	return j, ok
}

// Context is what a journey sees.
type Context struct {
	Page      playwright.Page
	BaseURL   string
	Gates     *uxgates.Recorder
	Listeners *browser.Listeners
	Viewport  playwright.Size
	RunDir    string
	// RenderAt is where Goto runs the render gate (current viewport plus the
	// other end of the width range).
	RenderAt []playwright.Size
	Logf     func(format string, args ...any)

	gateErrs []error
}

// URL joins a path onto the base URL.
func (c *Context) URL(path string) string {
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return c.BaseURL + path
}

// Goto navigates and runs the pagestate, render and a11y gates, waiting on the
// shared page-content marker.
func (c *Context) Goto(path string) error { return c.GotoMarker(path, "") }

// GotoMarker is Goto with a different "rendered" marker, for screens the app
// does not own (the framework's not-found screen).
func (c *Context) GotoMarker(path, marker string) error {
	c.Logf("goto %s", path)
	if _, err := c.Page.Goto(c.URL(path), playwright.PageGotoOptions{WaitUntil: playwright.WaitUntilStateLoad}); err != nil {
		return fmt.Errorf("goto %s: %w", path, err)
	}
	if c.Gates.Enabled() {
		if err := uxgates.CheckPage(c.Page, c.Gates, path, uxgates.PageStateOptions{Marker: marker}, c.RenderAt); err != nil {
			c.gateErrs = append(c.gateErrs, err)
		}
		return nil
	}
	m := marker
	if m == "" {
		m = defaultMarker
	}
	if err := c.Page.Locator(m).First().WaitFor(); err != nil {
		return fmt.Errorf("%s: marker %s never appeared: %w", path, m, err)
	}
	return nil
}

// Snap writes an extra named screenshot into the run directory.
func (c *Context) Snap(name string) (string, error) {
	return browser.Screenshot(c.Page, filepath.Join(c.RunDir, safe(name)+".png"), c.RunDir)
}

var unsafe = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func safe(s string) string { return unsafe.ReplaceAllString(s, "_") }

// expect returns a readable error when cond is false. The message must make
// sense without opening the source, e.g.
// `/: expected h1 "MyShelf", found "MyShelff"`.
func expect(cond bool, format string, args ...any) error {
	if cond {
		return nil
	}
	return fmt.Errorf(format, args...)
}

// Options configure a journey run.
type Options struct {
	BaseURL       string
	Headless      bool
	ScreenshotDir string
	Viewport      playwright.Size
	ColorScheme   string
	Mode          uxgates.Mode
	RenderAt      []playwright.Size
}

// Result is one journey's outcome plus where its evidence is.
type Result struct {
	Name         string            `json:"name"`
	Suite        string            `json:"suite"`
	OK           bool              `json:"ok"`
	Error        string            `json:"error,omitempty"`
	DurationMs   int64             `json:"durationMs"`
	Gates        uxgates.Summary   `json:"gates"`
	GateFailures []string          `json:"gateFailures,omitempty"`
	Artifacts    browser.Artifacts `json:"artifacts"`
}

// RunOne runs a journey in a fresh browser with its own run directory. The
// console and network gates run at the end, after the assertions.
func RunOne(j Journey, o Options) (res Result) {
	start := time.Now()
	res = Result{Name: j.Name, Suite: j.Suite}
	rec := uxgates.NewRecorder(o.Mode)
	logf := func(format string, args ...any) {
		fmt.Fprintf(os.Stderr, "  [%s] "+format+"\n", append([]any{j.Name}, args...)...)
	}
	run, err := browser.NewRun("journey-"+j.Name, o.Headless, o.ScreenshotDir, o.Viewport, o.ColorScheme)
	if err != nil {
		res.Error = err.Error()
		res.Gates = rec.Summary()
		res.DurationMs = time.Since(start).Milliseconds()
		return res
	}
	run.Gates = rec
	c := &Context{
		Page: run.Page, BaseURL: o.BaseURL, Gates: rec, Listeners: run.Listeners,
		Viewport: o.Viewport, RunDir: run.Dir, RenderAt: o.RenderAt, Logf: logf,
	}
	var errs []error
	func() {
		defer func() {
			if p := recover(); p != nil {
				errs = append(errs, fmt.Errorf("journey panicked: %v\n%s", p, debug.Stack()))
			}
		}()
		errs = append(errs, j.Run(c))
	}()
	errs = append(errs, c.gateErrs...)
	errs = append(errs, uxgates.CheckTraffic(run.Listeners, rec, j.Name))

	res.Artifacts = run.FinishOrLog()
	run.Close()
	if err := errors.Join(errs...); err != nil {
		res.Error = err.Error()
	}
	res.OK = res.Error == ""
	res.Gates = rec.Summary()
	res.GateFailures = failures(rec)
	res.DurationMs = time.Since(start).Milliseconds()
	return res
}

func failures(rec *uxgates.Recorder) []string {
	var out []string
	for _, r := range rec.Results() {
		for _, f := range r.Findings {
			if f.Severity != uxgates.SeverityError {
				continue
			}
			out = append(out, fmt.Sprintf("%s/%s [%s]: %s", f.Gate, f.Rule, r.Target, f.Message))
		}
	}
	return out
}
