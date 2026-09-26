package uxgates

import "strings"

// ExpectedMissingMarker is embedded in URLs that a journey requests knowing
// they do not exist (the 404 journey). The console and network gates both skip
// anything whose URL or text contains it. Defined once, read by both, so the
// exemption is precise instead of an allowlist rule that hides every real 404.
const ExpectedMissingMarker = "__expected-404"

// IsExpectedMissing reports whether s refers to a deliberately missing URL.
func IsExpectedMissing(s string) bool { return strings.Contains(s, ExpectedMissingMarker) }
