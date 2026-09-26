// Package uxgates holds the checks that run alongside journey assertions and
// catch what ships green: a blank page, an unstyled page, console errors,
// failed requests and structural accessibility regressions.
package uxgates

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/browser"
	"github.com/mxschmitt/playwright-go"
)

// Mode controls whether gate failures fail the run.
type Mode int

const (
	// ModeOff skips the gates entirely.
	ModeOff Mode = iota
	// ModeWarn runs the gates and records findings without failing.
	ModeWarn
	// ModeFail runs the gates and fails the run on any failing result.
	ModeFail
)

// ParseMode parses the --ux-gates flag value.
func ParseMode(s string) (Mode, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "off":
		return ModeOff, nil
	case "warn", "":
		return ModeWarn, nil
	case "fail":
		return ModeFail, nil
	}
	return ModeOff, fmt.Errorf("invalid --ux-gates %q (want off, warn or fail)", s)
}

func (m Mode) String() string {
	switch m {
	case ModeOff:
		return "off"
	case ModeFail:
		return "fail"
	default:
		return "warn"
	}
}

// Severity values. Only SeverityError findings make a Result fail.
const (
	SeverityError = "error"
	SeverityWarn  = "warn"
)

// Finding is one problem a gate observed, with the evidence for it.
type Finding struct {
	Gate     string         `json:"gate"`
	Rule     string         `json:"rule,omitempty"`
	Severity string         `json:"severity"`
	Message  string         `json:"message"`
	Evidence map[string]any `json:"evidence,omitempty"`
}

// Result is one gate run against one target (a URL, optionally at a viewport).
type Result struct {
	Gate       string    `json:"gate"`
	Target     string    `json:"target"`
	Pass       bool      `json:"pass"`
	DurationMs int64     `json:"durationMs"`
	Findings   []Finding `json:"findings"`
	Skipped    []string  `json:"skipped,omitempty"` // disabled rules, with reasons
}

func newResult(gate, target string, start time.Time, findings []Finding) Result {
	if findings == nil {
		findings = []Finding{}
	}
	pass := true
	for i := range findings {
		findings[i].Gate = gate
		if findings[i].Severity == "" {
			findings[i].Severity = SeverityError
		}
		if findings[i].Severity == SeverityError {
			pass = false
		}
	}
	return Result{Gate: gate, Target: target, Pass: pass, DurationMs: time.Since(start).Milliseconds(), Findings: findings}
}

// Recorder collects results for one run and writes uxgates.json.
type Recorder struct {
	mu      sync.Mutex
	mode    Mode
	results []Result
	waivers []Waiver
}

// Waiver downgrades one gate rule to a warning for one journey. The finding is
// still recorded, marked as waived with the reason; nothing disappears.
type Waiver struct {
	Gate   string `json:"gate"`
	Rule   string `json:"rule"`
	Reason string `json:"reason"`
}

// Waive registers a waiver. A reason is mandatory.
func (r *Recorder) Waive(gate, rule, reason string) {
	if strings.TrimSpace(reason) == "" {
		panic("uxgates: a waiver needs a reason")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.waivers = append(r.waivers, Waiver{gate, rule, reason})
}

func (r *Recorder) applyWaivers(res Result) Result {
	r.mu.Lock()
	ws := append([]Waiver(nil), r.waivers...)
	r.mu.Unlock()
	if len(ws) == 0 {
		return res
	}
	pass := true
	for i, f := range res.Findings {
		for _, w := range ws {
			if w.Gate == f.Gate && w.Rule == f.Rule && f.Severity == SeverityError {
				res.Findings[i].Severity = SeverityWarn
				res.Findings[i].Message = "[waived: " + w.Reason + "] " + f.Message
			}
		}
		if res.Findings[i].Severity == SeverityError {
			pass = false
		}
	}
	res.Pass = pass
	return res
}

// NewRecorder returns a recorder for the given mode.
func NewRecorder(mode Mode) *Recorder { return &Recorder{mode: mode} }

// Mode returns the recorder's mode.
func (r *Recorder) Mode() Mode { return r.mode }

// Enabled reports whether gates should run at all.
func (r *Recorder) Enabled() bool { return r != nil && r.mode != ModeOff }

// Add records a result. It returns an error only in ModeFail and only when the
// result failed, which is what makes --ux-gates warn usable during cleanup.
func (r *Recorder) Add(res Result) error {
	if r == nil {
		return nil
	}
	res = r.applyWaivers(res)
	r.mu.Lock()
	r.results = append(r.results, res)
	r.mu.Unlock()
	if res.Pass || r.mode != ModeFail {
		return nil
	}
	return &GateError{Result: res}
}

// Results returns a copy of what was recorded.
func (r *Recorder) Results() []Result {
	if r == nil {
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]Result(nil), r.results...)
}

// Failed reports whether any recorded result failed, regardless of mode.
func (r *Recorder) Failed() bool {
	for _, res := range r.Results() {
		if !res.Pass {
			return true
		}
	}
	return false
}

// Summary counts results and findings per gate.
type Summary struct {
	Mode     string         `json:"mode"`
	Failed   bool           `json:"failed"`
	Results  int            `json:"results"`
	Findings int            `json:"findings"`
	ByGate   map[string]int `json:"findingsByGate"`
}

// Summary returns counts for the JSON output.
func (r *Recorder) Summary() Summary {
	s := Summary{Mode: r.mode.String(), ByGate: map[string]int{}}
	for _, res := range r.Results() {
		s.Results++
		if !res.Pass {
			s.Failed = true
		}
		for _, f := range res.Findings {
			s.Findings++
			s.ByGate[f.Gate]++
		}
	}
	return s
}

// WriteJSON writes uxgates.json into dir. It satisfies browser.GatesWriter.
func (r *Recorder) WriteJSON(dir string) (string, error) {
	p := filepath.Join(dir, "uxgates.json")
	res := r.Results()
	if res == nil {
		res = []Result{}
	}
	r.mu.Lock()
	ws := append([]Waiver{}, r.waivers...)
	r.mu.Unlock()
	return p, browser.WriteJSONFile(p, struct {
		Mode    string   `json:"mode"`
		Failed  bool     `json:"failed"`
		Waivers []Waiver `json:"waivers"`
		Results []Result `json:"results"`
	}{r.mode.String(), r.Failed(), ws, res})
}

// GateError is returned by Recorder.Add in ModeFail.
type GateError struct{ Result Result }

func (e *GateError) Error() string {
	msgs := make([]string, 0, len(e.Result.Findings))
	for _, f := range e.Result.Findings {
		if f.Severity != SeverityError {
			continue
		}
		m := f.Message
		if f.Rule != "" {
			m = f.Rule + ": " + m
		}
		msgs = append(msgs, m)
	}
	return fmt.Sprintf("%s gate failed on %s: %s", e.Result.Gate, e.Result.Target, strings.Join(msgs, "; "))
}

// evaluate runs a JS function in the page and decodes its JSON-able result.
func evaluate(page playwright.Page, js string, arg any, out any) error {
	v, err := page.Evaluate(js, arg)
	if err != nil {
		return err
	}
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, out)
}
