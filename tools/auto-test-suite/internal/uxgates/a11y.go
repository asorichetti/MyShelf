package uxgates

import (
	"time"

	"github.com/mxschmitt/playwright-go"
)

// a11yJS audits only what is objective from the DOM, in one evaluation so the
// whole audit sees a consistent DOM. Hidden elements (display:none, visibility
// hidden, or inside aria-hidden) are ignored: a navigator keeps inactive
// screens mounted, and they are not part of what the user perceives.
const a11yJS = `(cfg) => {
  const out = [];
  const off = new Set(cfg.disabled);
  const add = (rule, severity, message, detail) => { if (!off.has(rule)) out.push({rule, severity, message, detail: detail || {}}); };
  const shown = (el) => {
    if (el.closest('[aria-hidden="true"], [inert]')) return false;
    return el.checkVisibility ? el.checkVisibility({visibilityProperty: true}) : el.offsetParent !== null;
  };
  const describe = (el) => {
    let d = el.tagName.toLowerCase();
    if (el.id) d += '#' + el.id;
    const tid = el.getAttribute('data-testid'); if (tid) d += '[data-testid="' + tid + '"]';
    const role = el.getAttribute('role'); if (role) d += '[role="' + role + '"]';
    return d;
  };
  const text = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const name = (el) => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const t = lb.split(/\s+/).map(id => document.getElementById(id)).filter(Boolean).map(text).join(' ').trim(); if (t) return t; }
    const al = (el.getAttribute('aria-label') || '').trim(); if (al) return al;
    if (el.labels && el.labels.length) { const t = [...el.labels].map(text).join(' ').trim(); if (t) return t; }
    const t = text(el); if (t) return t;
    const alts = [...el.querySelectorAll('img[alt], [role="img"][aria-label]')].map(i => (i.getAttribute('alt') || i.getAttribute('aria-label') || '').trim()).filter(Boolean).join(' ');
    if (alts) return alts;
    const ti = (el.getAttribute('title') || '').trim(); if (ti) return ti;
    if (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type)) return (el.value || '').trim();
    return '';
  };

  // Headings: native h1-h6 and role="heading" with aria-level (default 2).
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')].filter(shown).map(el => {
    const lvl = el.hasAttribute('aria-level') ? parseInt(el.getAttribute('aria-level'), 10) : (/^H[1-6]$/.test(el.tagName) ? parseInt(el.tagName[1], 10) : 2);
    return {el, level: lvl, text: text(el).slice(0, 80)};
  });
  const h1s = headings.filter(h => h.level === 1);
  if (h1s.length !== 1) add('one-h1', 'error', 'expected exactly one h1, found ' + h1s.length, {h1s: h1s.map(h => ({element: describe(h.el), text: h.text}))});
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level, cur = headings[i].level;
    if (cur > prev + 1) add('heading-order', 'error', 'heading level skips from h' + prev + ' to h' + cur + ' at "' + headings[i].text + '"', {from: prev, to: cur, element: describe(headings[i].el)});
  }

  // Every img has an alt attribute (empty is a valid, deliberate choice).
  for (const img of document.querySelectorAll('img')) {
    if (img.closest('[aria-hidden="true"]')) continue;
    if (!img.hasAttribute('alt')) add('img-alt', 'error', 'img has no alt attribute: ' + (img.getAttribute('src') || '').slice(0, 120), {element: describe(img), src: img.getAttribute('src')});
  }

  // Buttons, links and tabs resolve to a non-empty accessible name.
  const interactive = document.querySelectorAll('button, a[href], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"]');
  for (const el of interactive) {
    if (!shown(el)) continue;
    if (!name(el)) add('accessible-name', 'error', describe(el) + ' has no accessible name', {element: describe(el), html: el.outerHTML.slice(0, 200)});
  }

  // First focusable element is a skip link.
  const focusable = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(shown);
  if (focusable.length) {
    const f = focusable[0];
    const isSkip = f.tagName === 'A' && (f.getAttribute('href') || '').startsWith('#');
    if (!isSkip) add('skip-link', 'error', 'first focusable element is ' + describe(f) + ', not a skip link', {element: describe(f)});
  }

  // Exactly one main.
  const mains = [...document.querySelectorAll('main, [role="main"]')].filter(shown);
  if (mains.length !== 1) add('one-main', 'error', 'expected exactly one visible main landmark, found ' + mains.length, {mains: mains.map(describe)});

  // Every nav uniquely labelled when there is more than one; always labelled.
  const navs = [...document.querySelectorAll('nav, [role="navigation"]')].filter(shown);
  const labels = navs.map(n => (n.getAttribute('aria-label') || '').trim() || (n.getAttribute('aria-labelledby') ? name(n) : ''));
  navs.forEach((n, i) => {
    if (!labels[i]) add('nav-labels', 'error', describe(n) + ' has no aria-label', {element: describe(n)});
    else if (labels.indexOf(labels[i]) !== i) add('nav-labels', 'error', 'nav label "' + labels[i] + '" is not unique', {element: describe(n), label: labels[i]});
  });

  // html has lang.
  if (!(document.documentElement.getAttribute('lang') || '').trim()) add('html-lang', 'error', '<html> has no lang attribute', {});
  return out;
}`

type a11yFinding struct {
	Rule     string         `json:"rule"`
	Severity string         `json:"severity"`
	Message  string         `json:"message"`
	Detail   map[string]any `json:"detail"`
}

// A11y runs the structural accessibility audit. It asserts only what is
// objective from the DOM; whether alt text is useful needs judgement.
func A11y(page playwright.Page, target string) Result {
	start := time.Now()
	cfg := activeConfig.A11y
	disabled := make([]string, 0, len(cfg.Disabled))
	for k := range cfg.Disabled {
		disabled = append(disabled, k)
	}
	var raw []a11yFinding
	var findings []Finding
	if err := evaluate(page, a11yJS, map[string]any{"disabled": disabled}, &raw); err != nil {
		findings = append(findings, Finding{Rule: "evaluate", Message: "a11y gate could not evaluate: " + err.Error()})
	}
	for _, f := range raw {
		findings = append(findings, Finding{Rule: f.Rule, Severity: f.Severity, Message: f.Message, Evidence: f.Detail})
	}
	res := newResult("a11y", target, start, findings)
	res.Skipped = skippedList(cfg.Disabled)
	return res
}
