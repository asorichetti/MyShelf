package cmd

import (
	"testing"

	"github.com/asorichetti/MyShelf/tools/auto-test-suite/internal/browser"
)

func TestBaseURL(t *testing.T) {
	defer func(old globalOpts) { g = old }(g)
	g.env, g.baseURL = "local", ""
	if got, err := baseURL(); err != nil || got != "http://localhost:8081" {
		t.Errorf("local = %q, %v", got, err)
	}
	g.baseURL = "http://localhost:9000/"
	if got, _ := baseURL(); got != "http://localhost:9000" {
		t.Errorf("--base-url should override --env, got %q", got)
	}
	g.baseURL, g.env = "", "nowhere"
	if _, err := baseURL(); err == nil {
		t.Error("unknown env must fail")
	}
}

func TestResolveURL(t *testing.T) {
	cases := map[string]string{"/": "http://h/", "shelf": "http://h/shelf", "https://x/y": "https://x/y"}
	for in, want := range cases {
		if got := resolveURL("http://h", in); got != want {
			t.Errorf("resolveURL(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestRenderViewportsCoverBothEnds(t *testing.T) {
	got := renderViewports(browser.Viewports["mobile"])
	if len(got) != 2 || got[0].Width != 390 || got[1].Width != 1280 {
		t.Errorf("mobile run should render at mobile and desktop, got %+v", got)
	}
}
