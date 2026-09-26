package browser

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/mxschmitt/playwright-go"
)

// Artifacts are the five files every browser command leaves behind.
type Artifacts struct {
	RunDir         string `json:"runDir"`
	ScreenshotPath string `json:"screenshot"`
	HTMLPath       string `json:"html"`
	ConsolePath    string `json:"console"`
	NetworkPath    string `json:"network"`
	UXGatesPath    string `json:"uxgates"`
}

// GatesWriter is declared structurally so uxgates (which imports browser) can
// satisfy it without an import cycle.
type GatesWriter interface {
	WriteJSON(dir string) (string, error)
}

// RunBundle is one browser, one page, its listeners and its run directory.
type RunBundle struct {
	Name      string
	Dir       string
	Viewport  playwright.Size
	Scheme    string
	Browser   *Browser
	Page      playwright.Page
	Listeners *Listeners
	Gates     GatesWriter

	finished  bool
	artifacts Artifacts
}

var unsafeName = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

// NewRun creates <dir>/<cmdName>-<unixMillis>/, launches a fresh browser and
// page, and attaches listeners before anything navigates.
func NewRun(cmdName string, headless bool, dir string, vp playwright.Size, scheme string) (*RunBundle, error) {
	runDir, err := makeRunDir(dir, cmdName)
	if err != nil {
		return nil, err
	}
	r := &RunBundle{Name: cmdName, Dir: runDir, Viewport: vp, Scheme: scheme}
	b, err := New(headless)
	if err != nil {
		r.writePlaceholder(err)
		return nil, err
	}
	r.Browser = b
	page, err := b.NewPage(vp, scheme)
	if err != nil {
		r.writePlaceholder(err)
		b.Close()
		return nil, err
	}
	r.Page = page
	r.Listeners = Attach(page)
	return r, nil
}

// makeRunDir creates a timestamped directory that never collides with an
// earlier run, even when two runs start in the same millisecond.
func makeRunDir(dir, cmdName string) (string, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return "", fmt.Errorf("create screenshot dir: %w", err)
	}
	base := fmt.Sprintf("%s-%d", unsafeName.ReplaceAllString(cmdName, "_"), time.Now().UnixMilli())
	for i := 0; i < 1000; i++ {
		name := base
		if i > 0 {
			name = fmt.Sprintf("%s-%d", base, i)
		}
		p := filepath.Join(abs, name)
		err := os.Mkdir(p, 0o755)
		if err == nil {
			return p, nil
		}
		if !errors.Is(err, os.ErrExist) {
			return "", fmt.Errorf("create run dir: %w", err)
		}
	}
	return "", fmt.Errorf("could not allocate a run dir under %s", abs)
}

// Finish writes the bundle: screenshot.png, page.html, console.json,
// network.json and uxgates.json. It keeps writing after an individual failure so
// a broken page still leaves as much evidence as possible.
func (r *RunBundle) Finish() (Artifacts, error) {
	a := Artifacts{RunDir: r.Dir}
	var errs []error
	if r.Page != nil && !r.Page.IsClosed() {
		if p, err := Screenshot(r.Page, "", r.Dir); err != nil {
			errs = append(errs, err)
		} else {
			a.ScreenshotPath = p
		}
		html, err := r.Page.Content()
		if err != nil {
			errs = append(errs, fmt.Errorf("page content: %w", err))
			html = fmt.Sprintf("<!-- auto-test-suite: could not read page content: %v -->\n", err)
		}
		a.HTMLPath = filepath.Join(r.Dir, "page.html")
		if err := os.WriteFile(a.HTMLPath, []byte(html), 0o644); err != nil {
			errs = append(errs, err)
		}
	} else {
		errs = append(errs, errors.New("page is closed; no screenshot or DOM"))
		a.HTMLPath = filepath.Join(r.Dir, "page.html")
		_ = os.WriteFile(a.HTMLPath, []byte("<!-- auto-test-suite: page was closed before capture -->\n"), 0o644)
	}
	if r.Listeners != nil {
		c, n, err := r.Listeners.WriteJSON(r.Dir)
		if err != nil {
			errs = append(errs, err)
		}
		a.ConsolePath, a.NetworkPath = c, n
	}
	if r.Gates != nil {
		p, err := r.Gates.WriteJSON(r.Dir)
		if err != nil {
			errs = append(errs, err)
		}
		a.UXGatesPath = p
	} else {
		a.UXGatesPath = filepath.Join(r.Dir, "uxgates.json")
		if err := WriteJSONFile(a.UXGatesPath, map[string]any{"mode": "off", "results": []any{}}); err != nil {
			errs = append(errs, err)
		}
	}
	r.artifacts = a
	if err := errors.Join(errs...); err != nil {
		return a, err
	}
	// Only now: a partial failure must leave Close() free to retry.
	r.finished = true
	return a, nil
}

// FinishOrLog is Finish for defers: errors go to stderr.
func (r *RunBundle) FinishOrLog() Artifacts {
	a, err := r.Finish()
	if err != nil {
		fmt.Fprintf(os.Stderr, "bundle %s: %v\n", r.Dir, err)
	}
	return a
}

// Artifacts returns what the last Finish wrote.
func (r *RunBundle) Artifacts() Artifacts { return r.artifacts }

// Close writes the bundle if nothing else did, then shuts the browser down.
// A run directory must never come back empty.
func (r *RunBundle) Close() {
	if r == nil {
		return
	}
	if !r.finished {
		r.FinishOrLog()
	}
	r.Browser.Close()
}

// writePlaceholder leaves an explanation in a run dir whose browser never
// started, so even that failure has a bundle.
func (r *RunBundle) writePlaceholder(cause error) {
	msg := fmt.Sprintf("<!-- auto-test-suite: browser did not start: %v -->\n", cause)
	_ = os.WriteFile(filepath.Join(r.Dir, "page.html"), []byte(msg), 0o644)
	_ = WriteJSONFile(filepath.Join(r.Dir, "console.json"), []ConsoleEntry{})
	_ = WriteJSONFile(filepath.Join(r.Dir, "network.json"), []NetworkEntry{})
	_ = WriteJSONFile(filepath.Join(r.Dir, "uxgates.json"), map[string]any{"error": cause.Error(), "results": []any{}})
}
