
import { errorMessage } from '../errors.ts';
import { getConfig, skippedList } from './config.ts';
import { newResult, type RawFinding, type Result, type Severity } from './gate.ts';

import type { Page } from 'playwright';

export interface A11yAuditFinding {
  rule: string;
  severity: Severity;
  message: string;
  detail: Record<string, unknown>;
}

// a11yAudit audits only what is objective from the DOM, in one evaluation so
// the whole audit sees a consistent DOM. Hidden elements (display:none,
// visibility hidden, or inside aria-hidden) are ignored: a navigator keeps
// inactive screens mounted, and they are not part of what the user perceives.
// It must stay self-contained: page.evaluate serializes only this function.
export function a11yAudit(cfg: { disabled: string[] }): A11yAuditFinding[] {
  const out: A11yAuditFinding[] = [];
  const off = new Set(cfg.disabled);
  const add = (rule: string, severity: Severity, message: string, detail?: Record<string, unknown>) => {
    if (!off.has(rule)) out.push({ rule, severity, message, detail: detail || {} });
  };
  const shown = (el: Element) => {
    if (el.closest('[aria-hidden="true"], [inert]')) return false;
    return el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : (el as HTMLElement).offsetParent !== null;
  };
  const describe = (el: Element) => {
    let d = el.tagName.toLowerCase();
    if (el.id) d += '#' + el.id;
    const tid = el.getAttribute('data-testid');
    if (tid) d += '[data-testid="' + tid + '"]';
    const role = el.getAttribute('role');
    if (role) d += '[role="' + role + '"]';
    return d;
  };
  const text = (el: Element) => ((el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const name = (el: Element) => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter((x): x is HTMLElement => !!x)
        .map(text)
        .join(' ')
        .trim();
      if (t) return t;
    }
    const al = (el.getAttribute('aria-label') || '').trim();
    if (al) return al;
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length) {
      const t = [...labels].map(text).join(' ').trim();
      if (t) return t;
    }
    const t = text(el);
    if (t) return t;
    const alts = [...el.querySelectorAll('img[alt], [role="img"][aria-label]')]
      .map((i) => (i.getAttribute('alt') || i.getAttribute('aria-label') || '').trim())
      .filter(Boolean)
      .join(' ');
    if (alts) return alts;
    const ti = (el.getAttribute('title') || '').trim();
    if (ti) return ti;
    if (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes((el as HTMLInputElement).type)) return ((el as HTMLInputElement).value || '').trim();
    return '';
  };

  // Headings: native h1-h6 and role="heading" with aria-level (default 2).
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')].filter(shown).map((el) => {
    const lvl = el.hasAttribute('aria-level')
      ? parseInt(el.getAttribute('aria-level') || '', 10)
      : /^H[1-6]$/.test(el.tagName)
        ? parseInt(el.tagName[1]!, 10)
        : 2;
    return { el, level: lvl, text: text(el).slice(0, 80) };
  });
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length !== 1) {
    add('one-h1', 'error', 'expected exactly one h1, found ' + h1s.length, { h1s: h1s.map((h) => ({ element: describe(h.el), text: h.text })) });
  }
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1]!.level;
    const cur = headings[i]!.level;
    if (cur > prev + 1) {
      add('heading-order', 'error', 'heading level skips from h' + prev + ' to h' + cur + ' at "' + headings[i]!.text + '"', {
        from: prev,
        to: cur,
        element: describe(headings[i]!.el),
      });
    }
  }

  // Every img has an alt attribute (empty is a valid, deliberate choice).
  for (const img of document.querySelectorAll('img')) {
    if (img.closest('[aria-hidden="true"]')) continue;
    if (!img.hasAttribute('alt')) {
      add('img-alt', 'error', 'img has no alt attribute: ' + (img.getAttribute('src') || '').slice(0, 120), { element: describe(img), src: img.getAttribute('src') });
    }
  }

  // Buttons, links and tabs resolve to a non-empty accessible name.
  const interactive = document.querySelectorAll(
    'button, a[href], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"]',
  );
  for (const el of interactive) {
    if (!shown(el)) continue;
    if (!name(el)) add('accessible-name', 'error', describe(el) + ' has no accessible name', { element: describe(el), html: el.outerHTML.slice(0, 200) });
  }

  // First focusable element is a skip link.
  const focusable = [
    ...document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter(shown);
  if (focusable.length) {
    const f = focusable[0]!;
    const isSkip = f.tagName === 'A' && (f.getAttribute('href') || '').startsWith('#');
    if (!isSkip) add('skip-link', 'error', 'first focusable element is ' + describe(f) + ', not a skip link', { element: describe(f) });
  }

  // Exactly one main.
  const mains = [...document.querySelectorAll('main, [role="main"]')].filter(shown);
  if (mains.length !== 1) add('one-main', 'error', 'expected exactly one visible main landmark, found ' + mains.length, { mains: mains.map(describe) });

  // Every nav uniquely labelled when there is more than one; always labelled.
  const navs = [...document.querySelectorAll('nav, [role="navigation"]')].filter(shown);
  const labels = navs.map((n) => (n.getAttribute('aria-label') || '').trim() || (n.getAttribute('aria-labelledby') ? name(n) : ''));
  navs.forEach((n, i) => {
    if (!labels[i]) add('nav-labels', 'error', describe(n) + ' has no aria-label', { element: describe(n) });
    else if (labels.indexOf(labels[i]!) !== i) add('nav-labels', 'error', 'nav label "' + labels[i] + '" is not unique', { element: describe(n), label: labels[i] });
  });

  // html has lang.
  if (!(document.documentElement.getAttribute('lang') || '').trim()) add('html-lang', 'error', '<html> has no lang attribute', {});
  return out;
}

// a11yGate runs the structural accessibility audit. It asserts only what is
// objective from the DOM; whether alt text is useful needs judgement.
export async function a11yGate(page: Page, target: string): Promise<Result> {
  const start = Date.now();
  const cfg = getConfig().a11y;
  const findings: RawFinding[] = [];
  try {
    const raw = await page.evaluate(a11yAudit, { disabled: Object.keys(cfg.disabled) });
    for (const f of raw) findings.push({ rule: f.rule, severity: f.severity, message: f.message, evidence: f.detail });
  } catch (err) {
    findings.push({ rule: 'evaluate', message: `a11y gate could not evaluate: ${errorMessage(err)}` });
  }
  return newResult('a11y', target, start, findings, skippedList(cfg.disabled));
}
