package cmd

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/browser"
	"github.com/mxschmitt/playwright-go"
	"github.com/spf13/cobra"
)

var shotOpts struct {
	url       string
	viewports string
	schemes   string
	marker    string
	wait      int
}

var screenshotCmd = &cobra.Command{
	Use:     "screenshot",
	Short:   "Capture a viewport x color-scheme matrix; one fresh browser and bundle per combination",
	Example: `  auto-test-suite screenshot --url / --viewports mobile,desktop --schemes light,dark`,
	RunE: func(cmd *cobra.Command, _ []string) error {
		start := time.Now()
		vps := splitList(shotOpts.viewports)
		schemes := splitList(shotOpts.schemes)
		if len(schemes) == 0 {
			schemes = []string{""}
		}
		var sizes []playwright.Size
		for _, v := range vps {
			s, err := browser.ResolveViewport(v)
			if err != nil {
				return err
			}
			sizes = append(sizes, s)
		}
		var shots []navigateResult
		var errs []error
		for i, vp := range sizes {
			for _, scheme := range schemes {
				// A page's colour scheme is fixed at creation: new browser per combination.
				name := "screenshot-" + vps[i]
				if scheme != "" {
					name += "-" + scheme
				}
				r, err := navigateOnce(name, shotOpts.url, vp, scheme, shotOpts.marker, shotOpts.wait, []playwright.Size{vp})
				shots = append(shots, r)
				if err != nil {
					errs = append(errs, fmt.Errorf("%s: %w", name, err))
				}
			}
		}
		err := errors.Join(errs...)
		emit(map[string]any{
			"command": "screenshot", "ok": err == nil, "url": shotOpts.url,
			"durationMs": time.Since(start).Milliseconds(), "shots": shots,
		})
		return err
	},
}

func init() {
	f := screenshotCmd.Flags()
	f.StringVar(&shotOpts.url, "url", "/", "path or absolute URL")
	f.StringVar(&shotOpts.viewports, "viewports", "mobile,desktop", "comma-separated viewport presets")
	f.StringVar(&shotOpts.schemes, "schemes", "light,dark", "comma-separated color schemes (light, dark, no-preference)")
	f.StringVar(&shotOpts.marker, "marker", "", "selector that means the page rendered (default: the page-content testid)")
	f.IntVar(&shotOpts.wait, "wait", 0, "extra milliseconds to wait before the traffic gates snapshot")
	rootCmd.AddCommand(screenshotCmd)
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
