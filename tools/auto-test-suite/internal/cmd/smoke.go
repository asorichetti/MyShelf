package cmd

import "github.com/spf13/cobra"

var smokeCmd = &cobra.Command{
	Use:   "smoke",
	Short: "Run the core suite with --ux-gates fail, headless (unless those flags are passed explicitly)",
	RunE: func(cmd *cobra.Command, _ []string) error {
		pf := cmd.Flags()
		if !pf.Changed("headless") {
			g.headless = true
		}
		if !pf.Changed("ux-gates") {
			g.uxGates = "fail"
		}
		journeyOpts.suite = "core"
		selected, label, err := selectJourneys(nil)
		if err != nil {
			return err
		}
		return runJourneys("smoke", selected, label)
	},
}

func init() { rootCmd.AddCommand(smokeCmd) }
