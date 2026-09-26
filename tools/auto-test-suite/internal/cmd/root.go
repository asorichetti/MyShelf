// Package cmd holds the cobra commands. Every command prints exactly one JSON
// document on stdout; human progress goes to stderr.
package cmd

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"sort"
	"strings"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/browser"
	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/uxgates"
	"github.com/mxschmitt/playwright-go"
	"github.com/spf13/cobra"
)

// Environments maps --env to a base URL.
var Environments = map[string]string{
	"local": "http://localhost:8081",
}

type globalOpts struct {
	env              string
	baseURL          string
	headless         bool
	screenshotDir    string
	uxGates          string
	viewport         string
	colorScheme      string
	gatesConfig      string
	consoleAllowlist string
}

var (
	g       globalOpts
	emitted bool
)

var rootCmd = &cobra.Command{
	Use:   "auto-test-suite",
	Short: "Browser automation for MyShelf that leaves an evidence bundle behind every run",
	Long: `auto-test-suite drives the MyShelf web build in Chromium. Every browser command writes a
bundle (screenshot.png, page.html, console.json, network.json, uxgates.json) to
a fresh run directory, prints one JSON document on stdout, and exits non-zero on
failure. Progress goes to stderr.`,
	SilenceUsage:  true,
	SilenceErrors: true,
	PersistentPreRunE: func(cmd *cobra.Command, _ []string) error {
		if err := uxgates.LoadConfig(g.gatesConfig); err != nil {
			return err
		}
		if err := uxgates.LoadAllowlist(g.consoleAllowlist); err != nil {
			return err
		}
		if _, err := uxgates.ParseMode(g.uxGates); err != nil {
			return err
		}
		if _, err := browser.ResolveViewport(g.viewport); err != nil {
			return err
		}
		_, err := baseURL()
		return err
	},
}

func init() {
	envs := make([]string, 0, len(Environments))
	for k := range Environments {
		envs = append(envs, k)
	}
	sort.Strings(envs)
	f := rootCmd.PersistentFlags()
	f.StringVar(&g.env, "env", "local", "target environment ("+strings.Join(envs, ", ")+")")
	f.StringVar(&g.baseURL, "base-url", "", "base URL; overrides --env")
	f.BoolVar(&g.headless, "headless", browser.DefaultHeadless(), "run Chromium headless (default: true in CI or without a display; false on macOS)")
	f.StringVar(&g.screenshotDir, "screenshot-dir", "./screenshots", "parent directory for per-run bundles")
	f.StringVar(&g.uxGates, "ux-gates", "warn", "gate mode: off, warn or fail")
	f.StringVar(&g.viewport, "viewport", "mobile", "viewport preset: "+strings.Join(browser.ViewportNames(), ", "))
	f.StringVar(&g.colorScheme, "color-scheme", "", "emulated color scheme: light, dark or no-preference (default: browser default)")
	f.StringVar(&g.gatesConfig, "gates-config", "", "path to a gates config JSON (default: the embedded gates.config.json)")
	f.StringVar(&g.consoleAllowlist, "console-allowlist", "", "path to a console allowlist JSON (default: the embedded console_allowlist.json)")
}

// Execute runs the CLI and exits non-zero on failure. If a command failed
// before printing its result, a minimal JSON error document is printed so
// stdout is always JSON.
func Execute() {
	c, err := rootCmd.ExecuteC()
	if err == nil {
		return
	}
	if !emitted {
		name := "auto-test-suite"
		if c != nil {
			name = c.Name()
		}
		emit(map[string]any{"command": name, "ok": false, "error": err.Error()})
	}
	logf("error: %v", err)
	os.Exit(1)
}

// emit prints v as the command's single JSON result.
func emit(v any) {
	emitted = true
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		fmt.Fprintf(os.Stderr, "auto-test-suite: encode result: %v\n", err)
	}
}

// logf writes human progress to stderr.
func logf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "auto-test-suite: "+format+"\n", args...)
}

func baseURL() (string, error) {
	raw := g.baseURL
	if raw == "" {
		u, ok := Environments[g.env]
		if !ok {
			return "", fmt.Errorf("unknown --env %q", g.env)
		}
		raw = u
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("invalid base URL %q", raw)
	}
	return strings.TrimRight(raw, "/"), nil
}

// resolveURL joins a path onto the base URL; absolute URLs pass through.
func resolveURL(base, p string) string {
	if strings.HasPrefix(p, "http://") || strings.HasPrefix(p, "https://") {
		return p
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return base + p
}

func gateMode() uxgates.Mode {
	m, _ := uxgates.ParseMode(g.uxGates)
	return m
}

func viewport() playwright.Size {
	vp, _ := browser.ResolveViewport(g.viewport)
	return vp
}

// renderViewports is where the render gate runs for every page: the selected
// viewport plus the other end of the range, so overflow at the narrow width
// and layout at the wide one are both checked.
func renderViewports(current playwright.Size) []playwright.Size {
	mobile, desktop := browser.Viewports["mobile"], browser.Viewports["desktop"]
	if h := current.Height; h > 0 {
		mobile.Height, desktop.Height = h, h
	}
	switch current.Width {
	case mobile.Width:
		return []playwright.Size{current, desktop}
	case desktop.Width:
		return []playwright.Size{current, mobile}
	default:
		return []playwright.Size{current, mobile, desktop}
	}
}

// gateFailures flattens failing findings into one-line messages for stdout.
func gateFailures(rec *uxgates.Recorder) []string {
	var out []string
	for _, r := range rec.Results() {
		for _, f := range r.Findings {
			if f.Severity != uxgates.SeverityError {
				continue
			}
			m := f.Gate
			if f.Rule != "" {
				m += "/" + f.Rule
			}
			out = append(out, fmt.Sprintf("%s [%s]: %s", m, r.Target, f.Message))
		}
	}
	return out
}
