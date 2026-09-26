package uxgates

import (
	"errors"
	"fmt"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/browser"
	"github.com/mxschmitt/playwright-go"
)

// CheckPage runs the DOM gates for a page that has just been loaded:
// pagestate first, then render at every viewport in renderAt (the page is
// resized and restored, so sideways overflow is caught at the narrow width and
// media queries are exercised from both sides), then a11y.
//
// When pagestate fails, render and a11y are skipped: on a blank page they only
// add noise that hides the real cause. The traffic gates still run later.
//
// The returned error is non-nil only in ModeFail.
func CheckPage(page playwright.Page, rec *Recorder, target string, ps PageStateOptions, renderAt []playwright.Size) error {
	if !rec.Enabled() {
		return nil
	}
	state := PageState(page, target, ps)
	if err := rec.Add(state); err != nil || !state.Pass {
		return err
	}
	var errs []error
	orig := page.ViewportSize()
	sizes := renderAt
	if len(sizes) == 0 && orig != nil {
		sizes = []playwright.Size{*orig}
	}
	for _, vp := range sizes {
		resized := orig != nil && (vp.Width != orig.Width || vp.Height != orig.Height)
		if resized {
			if err := page.SetViewportSize(vp.Width, vp.Height); err != nil {
				errs = append(errs, fmt.Errorf("resize to %dx%d: %w", vp.Width, vp.Height, err))
				continue
			}
			// Wait on layout, not a clock: two animation frames after resize.
			_, _ = page.Evaluate(`() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`)
		}
		errs = append(errs, rec.Add(Render(page, fmt.Sprintf("%s @%s", target, browser.ViewportName(vp)))))
	}
	if orig != nil {
		cur := page.ViewportSize()
		if cur == nil || cur.Width != orig.Width || cur.Height != orig.Height {
			if err := page.SetViewportSize(orig.Width, orig.Height); err != nil {
				errs = append(errs, fmt.Errorf("restore viewport: %w", err))
			}
			_, _ = page.Evaluate(`() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`)
		}
	}
	errs = append(errs, rec.Add(A11y(page, target)))
	return errors.Join(errs...)
}

// CheckTraffic runs the console and network gates over everything captured
// so far. Run it at the end, after assertions pass: a page that does the right
// thing while logging errors must still fail.
func CheckTraffic(l *browser.Listeners, rec *Recorder, target string) error {
	if !rec.Enabled() {
		return nil
	}
	return errors.Join(rec.Add(Console(l, target)), rec.Add(Network(l, target)))
}
