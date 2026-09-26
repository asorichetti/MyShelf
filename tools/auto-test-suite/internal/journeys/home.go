package journeys

import (
	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/browser"
	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/selectors"
)

var defaultMarker = selectors.PageState.Content

func init() {
	register(Journey{
		Name:  "home-loads",
		Suite: "core",
		Desc:  "Home renders its h1 inside the single main landmark, styled (bold, not default serif)",
		Run: func(c *Context) error {
			if err := c.Goto("/"); err != nil {
				return err
			}
			title := c.Page.Locator(selectors.Home.Title)
			if err := title.WaitFor(); err != nil {
				return expect(false, "/: home title %s never appeared: %v", selectors.Home.Title, err)
			}
			text, err := title.InnerText()
			if err != nil {
				return err
			}
			if err := expect(text == "MyShelf", "/: expected h1 %q, found %q", "MyShelf", text); err != nil {
				return err
			}
			var info struct {
				Tag        string `json:"tag"`
				Level      string `json:"level"`
				InMain     bool   `json:"inMain"`
				FontWeight string `json:"fontWeight"`
				FontFamily string `json:"fontFamily"`
				DocTitle   string `json:"docTitle"`
			}
			if err := evalJSON(c, `(sel) => {
				const el = document.querySelector(sel);
				const cs = getComputedStyle(el);
				return {tag: el.tagName, level: el.getAttribute('aria-level') || '', inMain: !!el.closest('main, [role="main"]'),
					fontWeight: cs.fontWeight, fontFamily: cs.fontFamily, docTitle: document.title};
			}`, selectors.Home.Title, &info); err != nil {
				return err
			}
			if err := expect(info.Tag == "H1", "/: expected home title to be an <h1>, found <%s aria-level=%q>", info.Tag, info.Level); err != nil {
				return err
			}
			if err := expect(info.InMain, "/: expected home title inside the main landmark"); err != nil {
				return err
			}
			// Computed style, never class names: react-native-web classes are generated.
			if err := expect(info.FontWeight == "700", "/: expected home title font-weight 700, computed %q (styles did not apply?)", info.FontWeight); err != nil {
				return err
			}
			if err := expect(!serifRe.MatchString(info.FontFamily), "/: home title renders in the default serif: %q", info.FontFamily); err != nil {
				return err
			}
			if err := expect(info.DocTitle == "MyShelf", "/: expected document title %q, found %q", "MyShelf", info.DocTitle); err != nil {
				return err
			}
			// Home is a landing screen: the main landmark must be visible in the root.
			root, err := c.Page.Locator(selectors.Home.Root).IsVisible()
			if err != nil {
				return err
			}
			return expect(root, "/: expected %s to be visible", selectors.Home.Root)
		},
	})

	register(Journey{
		Name:  "home-responsive",
		Suite: "responsive",
		Desc:  "Home at mobile, tablet and desktop: viewport meta present, title fully on screen, no sideways scroll",
		Run: func(c *Context) error {
			if err := c.Goto("/"); err != nil {
				return err
			}
			var meta string
			if err := evalJSON(c, `() => (document.querySelector('meta[name="viewport"]') || {}).content || ''`, nil, &meta); err != nil {
				return err
			}
			// Invisible in any desktop screenshot, fatal on a phone.
			if err := expect(containsAll(meta, "width=device-width", "initial-scale=1"), "/: viewport meta is %q, want width=device-width, initial-scale=1", meta); err != nil {
				return err
			}
			for _, name := range []string{"mobile", "tablet", "desktop"} {
				vp := browser.Viewports[name]
				if err := c.Page.SetViewportSize(vp.Width, vp.Height); err != nil {
					return err
				}
				if err := settle(c); err != nil {
					return err
				}
				var m struct {
					Visible     bool    `json:"visible"`
					Left        float64 `json:"left"`
					Right       float64 `json:"right"`
					ClientWidth float64 `json:"clientWidth"`
					ScrollWidth float64 `json:"scrollWidth"`
				}
				if err := evalJSON(c, `(sel) => {
					const el = document.querySelector(sel);
					const r = el.getBoundingClientRect();
					const de = document.documentElement;
					return {visible: r.width > 0 && r.height > 0, left: r.left, right: r.right, clientWidth: de.clientWidth, scrollWidth: de.scrollWidth};
				}`, selectors.Home.Title, &m); err != nil {
					return err
				}
				if err := expect(m.Visible, "/ @%s: home title has no box", name); err != nil {
					return err
				}
				if err := expect(m.Left >= 0 && m.Right <= m.ClientWidth, "/ @%s: home title spans %.0f..%.0fpx, outside the %.0fpx viewport", name, m.Left, m.Right, m.ClientWidth); err != nil {
					return err
				}
				if err := expect(m.ScrollWidth <= m.ClientWidth+1, "/ @%s: page scrolls sideways (scrollWidth %.0f > clientWidth %.0f)", name, m.ScrollWidth, m.ClientWidth); err != nil {
					return err
				}
				if _, err := c.Snap("home-" + name); err != nil {
					return err
				}
			}
			return c.Page.SetViewportSize(c.Viewport.Width, c.Viewport.Height)
		},
	})
}
