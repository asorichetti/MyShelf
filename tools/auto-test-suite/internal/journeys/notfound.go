package journeys

import (
	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/uxgates"
)

// expoRouterUnmatched is the testid Expo Router puts on its built-in
// not-found screen. It is framework-owned, so it is not in selectors.json;
// when the app adds its own +not-found screen, give it a generated testid and
// switch this journey to it.
const expoRouterUnmatched = `[data-testid="expo-router-unmatched"]`

func init() {
	register(Journey{
		Name:  "not-found",
		Suite: "core",
		Desc:  "An unknown route renders the not-found screen (h1 \"Unmatched Route\") instead of a blank page or home",
		Run: func(c *Context) error {
			// The built-in screen has no main landmark. Waive exactly those
			// rules, with the reason recorded in uxgates.json, rather than
			// disabling them globally.
			const why = "Expo Router's built-in not-found screen has no main landmark; replace with an app-owned +not-found screen"
			c.Gates.Waive("a11y", "one-main", why)
			c.Gates.Waive("render", "landmarks", why)

			path := "/missing-shelf" + uxgates.ExpectedMissingMarker
			if err := c.GotoMarker(path, expoRouterUnmatched); err != nil {
				return err
			}
			h1 := c.Page.Locator(expoRouterUnmatched + ` h1, ` + expoRouterUnmatched + ` [role="heading"][aria-level="1"]`).First()
			text, err := h1.InnerText()
			if err != nil {
				return expect(false, "%s: no h1 on the not-found screen: %v", path, err)
			}
			if err := expect(text == "Unmatched Route", "%s: expected h1 %q, found %q", path, "Unmatched Route", text); err != nil {
				return err
			}
			// The router must not have silently redirected somewhere else.
			url := c.Page.URL()
			return expect(url == c.URL(path), "%s: expected to stay on %s, landed on %s", path, c.URL(path), url)
		},
	})
}
