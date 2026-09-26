package journeys

import (
	"encoding/json"
	"regexp"
	"strings"
)

var serifRe = regexp.MustCompile(`(?i)^\s*"?(Times|serif|-webkit-standard)`)

// evalJSON evaluates js in the page and decodes the result into out.
func evalJSON(c *Context, js string, arg any, out any) error {
	v, err := c.Page.Evaluate(js, arg)
	if err != nil {
		return err
	}
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, out)
}

// settle waits two animation frames: layout after a resize, not a clock.
func settle(c *Context) error {
	_, err := c.Page.Evaluate(`() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`)
	return err
}

func containsAll(s string, subs ...string) bool {
	for _, sub := range subs {
		if !strings.Contains(strings.ReplaceAll(s, " ", ""), sub) {
			return false
		}
	}
	return true
}
