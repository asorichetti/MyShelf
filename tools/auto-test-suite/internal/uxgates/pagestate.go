package uxgates

import (
	"fmt"
	"time"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/selectors"
	"github.com/mxschmitt/playwright-go"
)

// PageStateOptions tune the pagestate gate.
type PageStateOptions struct {
	// Marker is the selector that means "content rendered". Defaults to the
	// shared page-content testid.
	Marker string
	// Timeout is how long to wait for Marker. Defaults to 15s.
	Timeout time.Duration
	// MinMainText is the minimum visible text length inside <main>.
	MinMainText int
}

// PageState catches the blank screen that throws nothing: it fails when the
// content marker never appears, when the error marker appears instead, or when
// the visible main landmark carries almost no text.
func PageState(page playwright.Page, target string, opts PageStateOptions) Result {
	start := time.Now()
	if opts.Marker == "" {
		opts.Marker = selectors.PageState.Content
	}
	if opts.Timeout == 0 {
		opts.Timeout = 15 * time.Second
	}
	if opts.MinMainText == 0 {
		opts.MinMainText = 10
	}
	var findings []Finding
	either := opts.Marker + ", " + selectors.PageState.Error
	err := page.Locator(either).First().WaitFor(playwright.LocatorWaitForOptions{
		State:   playwright.WaitForSelectorStateVisible,
		Timeout: playwright.Float(float64(opts.Timeout.Milliseconds())),
	})
	if err != nil {
		var probe struct {
			URL      string `json:"url"`
			Title    string `json:"title"`
			BodyText int    `json:"bodyTextLength"`
		}
		_ = evaluate(page, `() => ({url: location.href, title: document.title, bodyTextLength: (document.body && document.body.innerText || '').trim().length})`, nil, &probe)
		findings = append(findings, Finding{
			Rule:     "content-marker",
			Message:  fmt.Sprintf("content marker %s not visible within %s", opts.Marker, opts.Timeout),
			Evidence: map[string]any{"marker": opts.Marker, "url": probe.URL, "title": probe.Title, "bodyTextLength": probe.BodyText},
		})
		return newResult("pagestate", target, start, findings)
	}
	if n, _ := page.Locator(selectors.PageState.Error).Count(); n > 0 {
		if v, _ := page.Locator(selectors.PageState.Error).First().IsVisible(); v {
			txt, _ := page.Locator(selectors.PageState.Error).First().InnerText()
			findings = append(findings, Finding{
				Rule:     "error-marker",
				Message:  "page rendered its error state: " + truncate(txt, 200),
				Evidence: map[string]any{"marker": selectors.PageState.Error, "text": txt},
			})
		}
	}
	var main struct {
		Found bool `json:"found"`
		Text  int  `json:"textLength"`
	}
	if err := evaluate(page, `() => {
		const mains = [...document.querySelectorAll('main, [role="main"]')].filter(el => el.checkVisibility ? el.checkVisibility() : el.offsetParent !== null);
		if (!mains.length) return {found: false, textLength: 0};
		return {found: true, textLength: (mains[0].innerText || '').trim().length};
	}`, nil, &main); err != nil {
		findings = append(findings, Finding{Rule: "evaluate", Message: "could not inspect main: " + err.Error()})
	} else if main.Found && main.Text < opts.MinMainText {
		findings = append(findings, Finding{
			Rule:     "main-text",
			Message:  fmt.Sprintf("visible main has only %d characters of text (want >= %d)", main.Text, opts.MinMainText),
			Evidence: map[string]any{"textLength": main.Text},
		})
	}
	return newResult("pagestate", target, start, findings)
}
