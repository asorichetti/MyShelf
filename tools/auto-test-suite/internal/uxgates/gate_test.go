package uxgates

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestParseMode(t *testing.T) {
	for in, want := range map[string]Mode{"off": ModeOff, "warn": ModeWarn, "FAIL": ModeFail, "": ModeWarn} {
		got, err := ParseMode(in)
		if err != nil || got != want {
			t.Errorf("ParseMode(%q) = %v, %v; want %v", in, got, err, want)
		}
	}
	if _, err := ParseMode("loud"); err == nil {
		t.Error("ParseMode(loud) should fail")
	}
}

func TestRecorderAddReturnsErrorOnlyInFailMode(t *testing.T) {
	bad := newResult("console", "/x", timeZero(), []Finding{{Message: "boom"}})
	good := newResult("console", "/x", timeZero(), nil)
	if bad.Pass || !good.Pass {
		t.Fatalf("pass computed wrong: bad=%v good=%v", bad.Pass, good.Pass)
	}
	warn := NewRecorder(ModeWarn)
	if err := warn.Add(bad); err != nil {
		t.Errorf("warn mode returned %v", err)
	}
	if !warn.Failed() {
		t.Error("warn recorder should still report Failed()")
	}
	fail := NewRecorder(ModeFail)
	if err := fail.Add(good); err != nil {
		t.Errorf("passing result returned %v", err)
	}
	if err := fail.Add(bad); err == nil {
		t.Error("fail mode should return an error for a failing result")
	}
}

func TestWarnSeverityDoesNotFail(t *testing.T) {
	r := newResult("a11y", "/x", timeZero(), []Finding{{Severity: SeverityWarn, Message: "advisory"}})
	if !r.Pass {
		t.Error("a warn-only result should pass")
	}
}

func TestConfigRejectsUnexplainedOrUnknownRules(t *testing.T) {
	defer func() { _ = LoadConfig("") }()
	dir := t.TempDir()
	cases := map[string]string{
		"no-reason": `{"render":{"disabled":{"overflow":""}},"a11y":{}}`,
		"unknown":   `{"render":{},"a11y":{"disabled":{"nope":"why"}}}`,
		"token":     `{"render":{"requiredTokens":["ms-bg"]},"a11y":{}}`,
	}
	for name, body := range cases {
		p := filepath.Join(dir, name+".json")
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
		if err := LoadConfig(p); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestAllowlistRequiresReason(t *testing.T) {
	defer func() { _ = LoadAllowlist("") }()
	p := filepath.Join(t.TempDir(), "a.json")
	if err := os.WriteFile(p, []byte(`[{"pattern":"x"}]`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := LoadAllowlist(p); err == nil {
		t.Error("an allowlist entry without a reason must be rejected")
	}
}

func TestExpectedMissingMarker(t *testing.T) {
	if !IsExpectedMissing("http://localhost:8081/nope__expected-404") || IsExpectedMissing("http://localhost:8081/nope") {
		t.Error("marker detection is wrong")
	}
}

func timeZero() (t0 time.Time) { return time.Now() }

func TestWaiverDowngradesButKeepsFinding(t *testing.T) {
	rec := NewRecorder(ModeFail)
	rec.Waive("a11y", "one-main", "framework screen")
	res := newResult("a11y", "/x", time.Now(), []Finding{{Rule: "one-main", Message: "no main"}})
	if err := rec.Add(res); err != nil {
		t.Fatalf("waived finding still failed: %v", err)
	}
	got := rec.Results()[0]
	if len(got.Findings) != 1 || got.Findings[0].Severity != SeverityWarn {
		t.Fatalf("waived finding should be kept as a warning, got %+v", got.Findings)
	}
	other := newResult("a11y", "/x", time.Now(), []Finding{{Rule: "one-h1", Message: "two h1"}})
	if err := rec.Add(other); err == nil {
		t.Fatal("a different rule must not be waived")
	}
}
