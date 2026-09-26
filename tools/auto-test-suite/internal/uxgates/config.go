package uxgates

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"slices"
	"sort"
	"strings"
)

//go:embed gates.config.json
var defaultConfigJSON []byte

//go:embed console_allowlist.json
var defaultAllowlistJSON []byte

// Config tunes the render and a11y gates for this app. Every disabled rule must
// carry a reason: an unexplained exemption is how a real regression hides.
type Config struct {
	Render RenderConfig `json:"render"`
	A11y   A11yConfig   `json:"a11y"`
}

// RenderConfig configures the render gate.
type RenderConfig struct {
	// RequiredTokens are CSS custom properties that must resolve on :root.
	RequiredTokens []string `json:"requiredTokens"`
	// Landmarks are selectors that must have a non-zero, visible box.
	Landmarks []string `json:"landmarks"`
	// Disabled maps a render rule id to the reason it is off.
	Disabled map[string]string `json:"disabled"`
}

// A11yConfig configures the accessibility gate.
type A11yConfig struct {
	// Disabled maps an a11y rule id to the reason it is off.
	Disabled map[string]string `json:"disabled"`
}

// RenderRules and A11yRules list every rule id, so config typos are caught.
var (
	RenderRules = []string{"stylesheets", "tokens", "body-margin", "body-background", "font-family", "fonts-loaded", "fonts-error", "images", "overflow", "landmarks"}
	A11yRules   = []string{"one-h1", "heading-order", "img-alt", "accessible-name", "skip-link", "one-main", "nav-labels", "html-lang"}
)

// AllowRule silences one console error pattern. Both fields are required.
type AllowRule struct {
	Pattern string `json:"pattern"`
	Reason  string `json:"reason"`
	re      *regexp.Regexp
}

var (
	activeConfig    Config
	activeAllowlist []AllowRule
)

func init() {
	if err := LoadConfig(""); err != nil {
		panic(fmt.Sprintf("uxgates: embedded config is invalid: %v", err))
	}
	if err := LoadAllowlist(""); err != nil {
		panic(fmt.Sprintf("uxgates: embedded console allowlist is invalid: %v", err))
	}
}

// ActiveConfig returns the configuration in use.
func ActiveConfig() Config { return activeConfig }

// LoadConfig replaces the gate config from path, or the embedded default when
// path is empty.
func LoadConfig(path string) error {
	data := defaultConfigJSON
	if path != "" {
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		data = b
	}
	var c Config
	dec := json.NewDecoder(strings.NewReader(string(data)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&c); err != nil {
		return fmt.Errorf("parse gates config: %w", err)
	}
	if err := checkDisabled("render", c.Render.Disabled, RenderRules); err != nil {
		return err
	}
	if err := checkDisabled("a11y", c.A11y.Disabled, A11yRules); err != nil {
		return err
	}
	for _, t := range c.Render.RequiredTokens {
		if !strings.HasPrefix(t, "--") {
			return fmt.Errorf("render.requiredTokens: %q must be a CSS custom property (start with --)", t)
		}
	}
	activeConfig = c
	return nil
}

func checkDisabled(gate string, disabled map[string]string, known []string) error {
	for rule, reason := range disabled {
		if !slices.Contains(known, rule) {
			return fmt.Errorf("%s.disabled: unknown rule %q (known: %s)", gate, rule, strings.Join(known, ", "))
		}
		if strings.TrimSpace(reason) == "" {
			return fmt.Errorf("%s.disabled.%s: a reason is required", gate, rule)
		}
	}
	return nil
}

// LoadAllowlist replaces the console allowlist from path, or the embedded
// default when path is empty.
func LoadAllowlist(path string) error {
	data := defaultAllowlistJSON
	if path != "" {
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		data = b
	}
	var rules []AllowRule
	if err := json.Unmarshal(data, &rules); err != nil {
		return fmt.Errorf("parse console allowlist: %w", err)
	}
	for i := range rules {
		if strings.TrimSpace(rules[i].Pattern) == "" || strings.TrimSpace(rules[i].Reason) == "" {
			return fmt.Errorf("console allowlist entry %d: both pattern and reason are required", i)
		}
		re, err := regexp.Compile(rules[i].Pattern)
		if err != nil {
			return fmt.Errorf("console allowlist entry %d: %w", i, err)
		}
		rules[i].re = re
	}
	activeAllowlist = rules
	return nil
}

func skippedList(disabled map[string]string) []string {
	out := make([]string, 0, len(disabled))
	for rule, reason := range disabled {
		out = append(out, rule+": "+reason)
	}
	sort.Strings(out)
	return out
}
