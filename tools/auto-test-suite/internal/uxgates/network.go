package uxgates

import (
	"fmt"
	"strconv"
	"time"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/browser"
)

// Network fails on any request that got status >= 400 or no response at all,
// except URLs carrying ExpectedMissingMarker.
func Network(l *browser.Listeners, target string) Result {
	start := time.Now()
	_, entries := l.Snapshot()
	var findings []Finding
	for _, e := range entries {
		if IsExpectedMissing(e.URL) {
			continue
		}
		msg := fmt.Sprintf("%s %s -> %d %s", e.Method, e.URL, e.Status, e.StatusText)
		rule := "http-status"
		if e.Status == 0 {
			msg = fmt.Sprintf("%s %s failed: %s", e.Method, e.URL, e.Failure)
			rule = "request-failed"
		}
		findings = append(findings, Finding{
			Rule:    rule,
			Message: msg,
			Evidence: map[string]any{
				"url": e.URL, "method": e.Method, "status": e.Status,
				"resourceType": e.ResourceType, "failure": e.Failure,
			},
		})
	}
	return newResult("network", target, start, findings)
}

func itoa(n int) string { return strconv.Itoa(n) }
