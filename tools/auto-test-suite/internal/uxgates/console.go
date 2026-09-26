package uxgates

import (
	"time"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/browser"
)

// Console fails on any console error or uncaught page error that is neither
// allowlisted (pattern + reason) nor about a deliberately missing URL.
func Console(l *browser.Listeners, target string) Result {
	start := time.Now()
	entries, _ := l.Snapshot()
	var findings []Finding
	allowed := 0
	for _, e := range entries {
		if !e.IsError {
			continue
		}
		if IsExpectedMissing(e.Text) || IsExpectedMissing(e.Location) {
			continue
		}
		if rule := matchAllowlist(e.Text); rule != nil {
			allowed++
			continue
		}
		findings = append(findings, Finding{
			Rule:     e.Type,
			Message:  truncate(e.Text, 300),
			Evidence: map[string]any{"type": e.Type, "location": e.Location, "text": e.Text},
		})
	}
	res := newResult("console", target, start, findings)
	if allowed > 0 {
		res.Skipped = append(res.Skipped, "allowlisted console errors: "+itoa(allowed))
	}
	return res
}

func matchAllowlist(text string) *AllowRule {
	for i := range activeAllowlist {
		if activeAllowlist[i].re.MatchString(text) {
			return &activeAllowlist[i]
		}
	}
	return nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
