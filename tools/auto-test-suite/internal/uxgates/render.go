package uxgates

import (
	"time"

	"github.com/mxschmitt/playwright-go"
)

// renderJS checks that the page is styled, not merely present. It runs as one
// evaluation so every check sees the same DOM. Rule ids match RenderRules.
const renderJS = `async (cfg) => {
  const out = [];
  const off = new Set(cfg.disabled);
  const add = (rule, message, evidence) => { if (!off.has(rule)) out.push({rule, message, evidence: evidence || {}}); };
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
  const visible = (el) => el.checkVisibility ? el.checkVisibility({visibilityProperty: true, opacityProperty: false}) : el.offsetParent !== null;
  const describe = (el) => {
    if (!el || !el.tagName) return String(el);
    let d = el.tagName.toLowerCase();
    if (el.id) d += '#' + el.id;
    const tid = el.getAttribute('data-testid'); if (tid) d += '[data-testid="' + tid + '"]';
    const role = el.getAttribute('role'); if (role) d += '[role="' + role + '"]';
    const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
    if (cls.length) d += '.' + cls.join('.');
    return d;
  };

  // Stylesheets present and carrying readable rules.
  let sheets = 0, rules = 0, crossOrigin = 0;
  for (const s of document.styleSheets) {
    sheets++;
    try { rules += s.cssRules.length; } catch (e) { crossOrigin++; }
  }
  if (sheets === 0 || rules === 0) add('stylesheets', 'no stylesheet rules applied (sheets=' + sheets + ', readable rules=' + rules + ')', {sheets, rules, crossOrigin});

  // Design tokens resolve on :root.
  const rootStyle = getComputedStyle(document.documentElement);
  const missing = cfg.tokens.filter(t => !rootStyle.getPropertyValue(t).trim());
  if (missing.length) add('tokens', 'design tokens missing on :root: ' + missing.join(', '), {missing, required: cfg.tokens});

  // The reset landed: the browser default body margin is 8px.
  const body = document.body;
  const bs = getComputedStyle(body);
  if (bs.marginTop !== '0px' || bs.marginLeft !== '0px') add('body-margin', 'body margin is ' + bs.margin + ' (want 0): the global reset did not apply', {margin: bs.margin});

  // Body has a real background.
  const bg = bs.backgroundColor;
  if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') add('body-background', 'body background is transparent', {backgroundColor: bg});

  // Not rendering in the default serif: body, and a real text element in main.
  const serif = /^\s*("?)(Times|serif|-webkit-standard)/i;
  if (serif.test(bs.fontFamily)) add('font-family', 'body renders in the default serif: ' + bs.fontFamily, {element: 'body', fontFamily: bs.fontFamily});
  const main = [...document.querySelectorAll('main, [role="main"]')].find(visible);
  if (main) {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {acceptNode: n => n.textContent.trim().length > 3 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP});
    const node = walker.nextNode();
    if (node && node.parentElement) {
      const ff = getComputedStyle(node.parentElement).fontFamily;
      if (serif.test(ff)) add('font-family', 'text in main renders in the default serif: ' + ff, {element: describe(node.parentElement), fontFamily: ff});
    }
  }

  // Fonts actually loaded, and none errored.
  const fonts = document.fonts ? [...document.fonts] : [];
  const loaded = fonts.filter(f => f.status === 'loaded');
  const errored = fonts.filter(f => f.status === 'error');
  if (loaded.length === 0) add('fonts-loaded', 'no web font reached status "loaded" (' + fonts.length + ' declared)', {declared: fonts.map(f => f.family + ':' + f.status)});
  if (errored.length) add('fonts-error', errored.length + ' font(s) failed to load: ' + errored.map(f => f.family).join(', '), {errored: errored.map(f => f.family)});

  // Images loaded: complete alone is true for a 404, so check naturalWidth too.
  const broken = [...document.images].filter(img => !(img.complete && img.naturalWidth > 0));
  if (broken.length) add('images', broken.length + ' image(s) failed to load: ' + broken.slice(0, 5).map(i => i.currentSrc || i.src || describe(i)).join(', '), {images: broken.map(i => ({src: i.currentSrc || i.src, element: describe(i), complete: i.complete, naturalWidth: i.naturalWidth}))});

  // No sideways overflow. clientWidth, not innerWidth, so a scrollbar is not overflow.
  const de = document.documentElement;
  const cw = de.clientWidth;
  const clipped = (el) => { for (let p = el.parentElement; p && p !== body && p !== de; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox !== 'visible') return true; } return false; };
  const offenders = [];
  for (const el of body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= cw + 1) continue;
    if (clipped(el)) continue;
    if (offenders.some(o => o.contains(el))) continue;
    offenders.push(el);
  }
  if (de.scrollWidth > cw + 1 || offenders.length) {
    const els = offenders.slice(0, 5).map(el => ({element: describe(el), right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width)}));
    add('overflow', 'content overflows sideways at ' + cw + 'px' + (els.length ? ': ' + els.map(e => e.element + ' (right=' + e.right + 'px)').join(', ') : ' (scrollWidth=' + de.scrollWidth + ')'), {clientWidth: cw, scrollWidth: de.scrollWidth, offenders: els});
  }

  // Landmarks have a real, visible box.
  for (const sel of cfg.landmarks) {
    const el = [...document.querySelectorAll(sel === 'main' ? 'main, [role="main"]' : sel)].find(visible);
    if (!el) { add('landmarks', 'landmark ' + sel + ' is missing or hidden', {selector: sel}); continue; }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) add('landmarks', 'landmark ' + sel + ' has a zero-size box', {selector: sel, width: r.width, height: r.height});
  }
  return out;
}`

type jsFinding struct {
	Rule     string         `json:"rule"`
	Message  string         `json:"message"`
	Evidence map[string]any `json:"evidence"`
}

// Render fails when the page rendered but is not styled. Target should name
// the URL and viewport, because overflow only shows at narrow widths.
func Render(page playwright.Page, target string) Result {
	start := time.Now()
	cfg := activeConfig.Render
	disabled := make([]string, 0, len(cfg.Disabled))
	for k := range cfg.Disabled {
		disabled = append(disabled, k)
	}
	tokens := cfg.RequiredTokens
	if tokens == nil {
		tokens = []string{}
	}
	landmarks := cfg.Landmarks
	if landmarks == nil {
		landmarks = []string{}
	}
	var raw []jsFinding
	var findings []Finding
	if err := evaluate(page, renderJS, map[string]any{"tokens": tokens, "landmarks": landmarks, "disabled": disabled}, &raw); err != nil {
		findings = append(findings, Finding{Rule: "evaluate", Message: "render gate could not evaluate: " + err.Error()})
	}
	for _, f := range raw {
		findings = append(findings, Finding{Rule: f.Rule, Message: f.Message, Evidence: f.Evidence})
	}
	res := newResult("render", target, start, findings)
	res.Skipped = skippedList(cfg.Disabled)
	return res
}
