package cmd

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/journeys"
	"github.com/spf13/cobra"
)

type journeyListItem struct {
	Name  string `json:"name"`
	Suite string `json:"suite"`
	Desc  string `json:"desc"`
}

type journeyRunResult struct {
	Command    string            `json:"command"`
	OK         bool              `json:"ok"`
	Selection  string            `json:"selection"`
	GatesMode  string            `json:"gatesMode"`
	Viewport   string            `json:"viewport"`
	BaseURL    string            `json:"baseUrl"`
	Total      int               `json:"total"`
	Passed     int               `json:"passed"`
	Failed     int               `json:"failed"`
	DurationMs int64             `json:"durationMs"`
	Results    []journeys.Result `json:"results"`
}

var journeyOpts struct {
	all   bool
	suite string
	list  bool
	grep  string
}

var journeyCmd = &cobra.Command{
	Use:   "journey [name...]",
	Short: "Run journeys by name, --suite, --grep or --all; --list prints the registry",
	Example: `  auto-test-suite journey --list
  auto-test-suite journey home-loads
  auto-test-suite journey --suite core --ux-gates fail
  auto-test-suite journey --grep home --viewport desktop
  auto-test-suite journey --all`,
	RunE: func(cmd *cobra.Command, args []string) error {
		selected, label, err := selectJourneys(args)
		if err != nil {
			return err
		}
		if journeyOpts.list {
			items := make([]journeyListItem, 0, len(selected))
			for _, j := range selected {
				items = append(items, journeyListItem{j.Name, j.Suite, j.Desc})
				logf("%-18s %-11s %s", j.Name, j.Suite, j.Desc)
			}
			emit(map[string]any{"command": "journey", "ok": true, "list": true, "selection": label, "journeys": items})
			return nil
		}
		return runJourneys("journey", selected, label)
	},
}

func init() {
	f := journeyCmd.Flags()
	f.BoolVar(&journeyOpts.all, "all", false, "run every journey")
	f.StringVar(&journeyOpts.suite, "suite", "", "run every journey in this suite")
	f.BoolVar(&journeyOpts.list, "list", false, "print the selected journeys (all when nothing is selected) instead of running them")
	f.StringVar(&journeyOpts.grep, "grep", "", "run journeys whose name or description matches this regexp")
	rootCmd.AddCommand(journeyCmd)
}

func selectJourneys(names []string) ([]journeys.Journey, string, error) {
	all := journeys.All()
	var out []journeys.Journey
	var labels []string
	switch {
	case len(names) > 0:
		for _, n := range names {
			j, ok := journeys.Get(n)
			if !ok {
				known := make([]string, 0, len(all))
				for _, k := range all {
					known = append(known, k.Name)
				}
				return nil, "", fmt.Errorf("unknown journey %q (known: %s)", n, strings.Join(known, ", "))
			}
			out = append(out, j)
		}
		labels = append(labels, "names="+strings.Join(names, ","))
	case journeyOpts.all:
		out = all
		labels = append(labels, "all")
	default:
		out = all
		if journeyOpts.suite == "" && journeyOpts.grep == "" && !journeyOpts.list {
			return nil, "", fmt.Errorf("select journeys: pass names, --all, --suite, --grep or --list")
		}
		labels = append(labels, "all")
	}
	if journeyOpts.suite != "" {
		var keep []journeys.Journey
		for _, j := range out {
			if j.Suite == journeyOpts.suite {
				keep = append(keep, j)
			}
		}
		out = keep
		labels = append(labels, "suite="+journeyOpts.suite)
	}
	if journeyOpts.grep != "" {
		re, err := regexp.Compile(journeyOpts.grep)
		if err != nil {
			return nil, "", fmt.Errorf("--grep: %w", err)
		}
		var keep []journeys.Journey
		for _, j := range out {
			if re.MatchString(j.Name) || re.MatchString(j.Desc) {
				keep = append(keep, j)
			}
		}
		out = keep
		labels = append(labels, "grep="+journeyOpts.grep)
	}
	if len(out) == 0 && !journeyOpts.list {
		return nil, "", fmt.Errorf("no journeys match %s", strings.Join(labels, " "))
	}
	return out, strings.Join(labels, " "), nil
}

func runJourneys(command string, selected []journeys.Journey, label string) error {
	start := time.Now()
	base, _ := baseURL()
	vp := viewport()
	opts := journeys.Options{
		BaseURL: base, Headless: g.headless, ScreenshotDir: g.screenshotDir,
		Viewport: vp, ColorScheme: g.colorScheme, Mode: gateMode(), RenderAt: renderViewports(vp),
	}
	out := journeyRunResult{Command: command, Selection: label, GatesMode: gateMode().String(), Viewport: g.viewport, BaseURL: base}
	for i, j := range selected {
		logf("journey %d/%d %s (%s)", i+1, len(selected), j.Name, j.Suite)
		r := journeys.RunOne(j, opts)
		status := "PASS"
		if !r.OK {
			status = "FAIL"
		}
		logf("%s %s in %dms -> %s", status, j.Name, r.DurationMs, r.Artifacts.RunDir)
		if !r.OK {
			logf("  %s", r.Error)
		}
		out.Results = append(out.Results, r)
		if r.OK {
			out.Passed++
		} else {
			out.Failed++
		}
	}
	out.Total = len(selected)
	out.OK = out.Failed == 0
	out.DurationMs = time.Since(start).Milliseconds()
	logf("%d/%d journeys passed (gates %s)", out.Passed, out.Total, out.GatesMode)
	emit(out)
	if !out.OK {
		return fmt.Errorf("%d of %d journeys failed", out.Failed, out.Total)
	}
	return nil
}
