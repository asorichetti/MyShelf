package journeys

import (
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

}
