
import { errorMessage } from '../errors.ts';
import { getConfig, skippedList } from './config.ts';
import { ExpectedMissingMarker } from './expected.ts';
import { newResult, type RawFinding, type Result } from './gate.ts';

import type { Page } from 'playwright';

export interface RenderAuditConfig {
  tokens: string[];
  landmarks: string[];
  disabled: string[];
  /**
   * Images whose URL contains this marker are missing on purpose (a fixture's
   * broken cover, which the app replaces with its fallback), so the `images`
   * rule skips them like the console and network gates do.
   */
  expectedMissing?: string;
  /** How long images still downloading get to load or fail before counting as broken. */
  imageWaitMs?: number;
}

/**
 * Default wait for images still downloading. A tall page (a 200 % text run
 * renders every cover at once) on a busy machine can take well over 5 s;
 * AUTOTEST_IMAGE_WAIT_MS overrides it.
 */
export const DEFAULT_IMAGE_WAIT_MS = 15_000;

export interface RenderAuditFinding {
  rule: string;
  message: string;
  evidence: Record<string, unknown>;
}

// renderAudit checks that the page is styled, not merely present. It runs in
// the page as one evaluation so every check sees the same DOM. Rule ids match
// RenderRules. It must stay self-contained: page.evaluate serializes only this
// function, not anything it would close over.
export async function renderAudit(cfg: RenderAuditConfig): Promise<RenderAuditFinding[]> {
  const out: RenderAuditFinding[] = [];
  const off = new Set(cfg.disabled);
  const add = (rule: string, message: string, evidence?: Record<string, unknown>) => {
    if (!off.has(rule)) out.push({ rule, message, evidence: evidence || {} });
  };
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // a rejected ready promise still leaves statuses to inspect below
    }
  }
  const visible = (el: Element) =>
    el.checkVisibility ? el.checkVisibility({ visibilityProperty: true, opacityProperty: false }) : (el as HTMLElement).offsetParent !== null;
  const describe = (el: Element | null) => {
    if (!el || !el.tagName) return String(el);
    let d = el.tagName.toLowerCase();
    if (el.id) d += '#' + el.id;
    const tid = el.getAttribute('data-testid');
    if (tid) d += '[data-testid="' + tid + '"]';
    const role = el.getAttribute('role');
    if (role) d += '[role="' + role + '"]';
    const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
    if (cls.length) d += '.' + cls.join('.');
    return d;
  };

  // Stylesheets present and carrying readable rules.
  let sheets = 0;
  let rules = 0;
  let crossOrigin = 0;
  for (const s of document.styleSheets) {
    sheets++;
    try {
      rules += s.cssRules.length;
    } catch {
      crossOrigin++;
    }
  }
  if (sheets === 0 || rules === 0) {
    add('stylesheets', 'no stylesheet rules applied (sheets=' + sheets + ', readable rules=' + rules + ')', { sheets, rules, crossOrigin });
  }

  // Design tokens resolve on :root.
  const rootStyle = getComputedStyle(document.documentElement);
  const missing = cfg.tokens.filter((t) => !rootStyle.getPropertyValue(t).trim());
  if (missing.length) add('tokens', 'design tokens missing on :root: ' + missing.join(', '), { missing, required: cfg.tokens });

  // The reset landed: the browser default body margin is 8px.
  const body = document.body;
  const bs = getComputedStyle(body);
  if (bs.marginTop !== '0px' || bs.marginLeft !== '0px') {
    add('body-margin', 'body margin is ' + bs.margin + ' (want 0): the global reset did not apply', { margin: bs.margin });
  }

  // Body has a real background.
  const bg = bs.backgroundColor;
  if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') add('body-background', 'body background is transparent', { backgroundColor: bg });

  // Not rendering in the default serif: body, and a real text element in main.
  const serif = /^\s*("?)(Times|serif|-webkit-standard)/i;
  if (serif.test(bs.fontFamily)) add('body-font', 'body renders in the default serif: ' + bs.fontFamily, { element: 'body', fontFamily: bs.fontFamily });
  const main = [...document.querySelectorAll('main, [role="main"]')].find(visible);
  if (main) {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => ((n.textContent || '').trim().length > 3 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const node = walker.nextNode();
    if (node && node.parentElement) {
      const ff = getComputedStyle(node.parentElement).fontFamily;
      if (serif.test(ff)) add('text-font', 'text in main renders in the default serif: ' + ff, { element: describe(node.parentElement), fontFamily: ff });
    }
  }

  // Fonts actually loaded, and none errored.
  const fonts = document.fonts ? [...document.fonts] : [];
  const loaded = fonts.filter((f) => f.status === 'loaded');
  const errored = fonts.filter((f) => f.status === 'error');
  if (loaded.length === 0) {
    add('fonts-loaded', 'no web font reached status "loaded" (' + fonts.length + ' declared)', { declared: fonts.map((f) => f.family + ':' + f.status) });
  }
  if (errored.length) {
    add('fonts-error', errored.length + ' font(s) failed to load: ' + errored.map((f) => f.family).join(', '), { errored: errored.map((f) => f.family) });
  }

  // Images still downloading are not broken yet: give them time to load or fail.
  // A lazy image far below the fold (a long list at 200 % text) may not have
  // been asked for at all: ask for it now, so it is judged on whether it loads.
  const imageWaitMs = cfg.imageWaitMs ?? 15000;
  const waitStarted = Date.now();
  const inFlight = [...document.images].filter((img) => !img.complete);
  for (const img of inFlight) if (img.loading === 'lazy') img.loading = 'eager';
  if (inFlight.length) {
    const settled = inFlight.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    );
    await Promise.race([Promise.all(settled), new Promise<void>((resolve) => setTimeout(resolve, imageWaitMs))]);
  }
  const waitedMs = Date.now() - waitStarted;
  // Images loaded: complete alone is true for a 404, so check naturalWidth too.
  const deliberate = (img: HTMLImageElement) => !!cfg.expectedMissing && (img.currentSrc || img.src).includes(cfg.expectedMissing);
  const broken = [...document.images].filter((img) => !(img.complete && img.naturalWidth > 0) && !deliberate(img));
  if (broken.length) {
    add(
      'images',
      broken.length +
        ' image(s) failed to load' +
        (broken.some((i) => !i.complete) ? ' (some still downloading after ' + waitedMs + ' ms)' : '') +
        ': ' +
        broken.slice(0, 5).map((i) => i.currentSrc || i.src || describe(i)).join(', '),
      { waitedMs, images: broken.map((i) => ({ src: i.currentSrc || i.src, element: describe(i), complete: i.complete, naturalWidth: i.naturalWidth })) },
    );
  }

  // No sideways overflow. clientWidth, not innerWidth, so a scrollbar is not overflow.
  const de = document.documentElement;
  const cw = de.clientWidth;
  // Inside a horizontal scroll container, extending past the edge is the point.
  // Anything else past the edge is either scrollable sideways or cut off.
  const inScroller = (el: Element) => {
    for (let p = el.parentElement; p && p !== body && p !== de; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  const offenders: Element[] = [];
  for (const el of body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= cw + 1) continue;
    if (!visible(el) || inScroller(el)) continue;
    if (offenders.some((o) => o.contains(el))) continue;
    offenders.push(el);
  }
  if (de.scrollWidth > cw + 1 || offenders.length) {
    const els = offenders.slice(0, 5).map((el) => ({
      element: describe(el),
      right: Math.round(el.getBoundingClientRect().right),
      width: Math.round(el.getBoundingClientRect().width),
    }));
    add(
      'overflow',
      'content overflows sideways at ' + cw + 'px' +
        (els.length ? ': ' + els.map((e) => e.element + ' (right=' + e.right + 'px)').join(', ') : ' (scrollWidth=' + de.scrollWidth + ')'),
      { clientWidth: cw, scrollWidth: de.scrollWidth, offenders: els },
    );
  }

  // Landmarks have a real, visible box.
  for (const sel of cfg.landmarks) {
    const el = [...document.querySelectorAll(sel === 'main' ? 'main, [role="main"]' : sel)].find(visible);
    if (!el) {
      add('landmarks', 'landmark ' + sel + ' is missing or hidden', { selector: sel });
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) add('landmarks', 'landmark ' + sel + ' has a zero-size box', { selector: sel, width: r.width, height: r.height });
  }
  return out;
}

// renderGate fails when the page rendered but is not styled. target should
// name the URL and viewport, because overflow only shows at narrow widths.
export async function renderGate(page: Page, target: string): Promise<Result> {
  const start = Date.now();
  const cfg = getConfig().render;
  const findings: RawFinding[] = [];
  try {
    const raw = await page.evaluate(renderAudit, {
      tokens: cfg.requiredTokens,
      landmarks: cfg.landmarks,
      disabled: Object.keys(cfg.disabled),
      expectedMissing: ExpectedMissingMarker,
      imageWaitMs: Number(process.env.AUTOTEST_IMAGE_WAIT_MS) || DEFAULT_IMAGE_WAIT_MS,
    });
    for (const f of raw) findings.push({ rule: f.rule, message: f.message, evidence: f.evidence });
  } catch (err) {
    findings.push({ rule: 'evaluate', message: `render gate could not evaluate: ${errorMessage(err)}` });
  }
  return newResult('render', target, start, findings, skippedList(cfg.disabled));
}
