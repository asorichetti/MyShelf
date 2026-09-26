// PLAN §8: Booky's floating tip never covers a control the user may need.
// tipCover() looks at the page while a tip floats: every visible control
// (buttons, links, inputs, and role=button/link/tab/checkbox/switch/radio)
// whose centre the tip covers, found with document.elementFromPoint, must be
// scrollable into the clear, and so must every control further down a
// scrolling screen. Each one is scrolled until it sits just above the tip and
// hit-tested again; the page's scroll positions are put back afterwards.
import { Testids, tid } from '../selectors.ts';
import { expect, q, type Context } from './registry.ts';

import type { Page } from 'playwright';

/** What counts as a control. */
export const CONTROLS =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="switch"], [role="radio"]';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TipCover {
  /** The tip's box, or null when no tip floats. */
  tip: Rect | null;
  /** Controls looked at (on this screen, outside the tip), by name: each is clear of the tip or can be scrolled clear. */
  checked: string[];
  /** Controls whose centre the tip covered as the page stood, each revealed by scrolling. */
  revealed: string[];
  /** Controls the tip covers that scrolling cannot bring clear of it: each is a failure. */
  stuck: string[];
}

/** Where the floating tip is: Booky's tip host, which keeps the series tip's own test id for that tip. */
export const TIP_HOSTS = [tid(Testids.booky.tipHost), tid(Testids.seriesTip.root)];

/**
 * Checks the page against the floating tip (the first of `hosts` on the page).
 * Pure page logic, so the self-tests run it on hand-made pages.
 */
export function tipCover(page: Page, hosts: readonly string[] = TIP_HOSTS): Promise<TipCover> {
  return page.evaluate(
    async ([hostSels, controls]) => {
      const hostSel = (hostSels as string[]).find((sel) => document.querySelector(sel));
      const tipEl = hostSel ? document.querySelector(hostSel) : null;
      if (!tipEl) return { tip: null, checked: [] as string[], revealed: [] as string[], stuck: [] as string[] };
      const t = tipEl.getBoundingClientRect();
      const tip = { x: t.x, y: t.y, width: t.width, height: t.height };
      const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      // With the tip transparent to hit-testing, elementFromPoint says what is underneath it.
      const glass = document.createElement('style');
      glass.textContent = `${hostSel}, ${hostSel} * { pointer-events: none !important; }`;
      const beneath = (x: number, y: number) => {
        document.head.appendChild(glass);
        const el = document.elementFromPoint(x, y);
        glass.remove();
        return el;
      };
      const name = (el: Element) => {
        const label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        const id = el.getAttribute('data-testid');
        return `${label || el.tagName.toLowerCase()}${id ? ` [${id}]` : ''}`;
      };
      const isOn = (el: Element, hit: Element | null) => !!hit && (hit === el || el.contains(hit));
      const scrollers = (el: Element) => {
        const out: HTMLElement[] = [];
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (['auto', 'scroll'].includes(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight) out.push(p);
        }
        return out;
      };
      const gap = 4;
      const clearTop = tip.y - gap;

      const candidates = [...document.querySelectorAll(controls!)].filter((el) => {
        if (tipEl.contains(el) || el.closest('[aria-hidden="true"], [inert]')) return false;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        if (!(el as HTMLElement).checkVisibility?.({ visibilityProperty: true, opacityProperty: true })) return false;
        const cx = r.x + r.width / 2;
        return cx >= 0 && cx <= innerWidth;
      });

      const revealed: string[] = [];
      const stuck: string[] = [];
      const checked: string[] = [];
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        if (cy < 0) continue; // scrolled past: clear by scrolling back
        let covered = false;
        if (cy <= innerHeight) {
          const hit = document.elementFromPoint(cx, cy);
          if (!hit || !tipEl.contains(hit)) {
            // Clear, or behind something that is not the tip (a screen underneath).
            if (isOn(el, hit)) checked.push(name(el));
            continue;
          }
          // Under the tip: count it only if it is what is there once the tip is out of the way.
          if (!isOn(el, beneath(cx, cy))) continue;
          covered = true;
        } else if (!scrollers(el).length) {
          continue; // off screen with no way to scroll to it: not on this screen
        }
        // Scroll it until it sits just above the tip, as a user would, and look again.
        const moved = scrollers(el).map((s) => ({ s, top: s.scrollTop }));
        let delta = r.bottom - clearTop;
        for (const { s } of moved) {
          if (delta <= 0) break;
          const before = s.scrollTop;
          s.scrollTop = before + delta;
          delta -= s.scrollTop - before;
        }
        await frame();
        const n = el.getBoundingClientRect();
        const nx = n.x + n.width / 2;
        const ny = n.y + n.height / 2;
        const hit = ny >= 0 && ny <= innerHeight ? document.elementFromPoint(nx, ny) : null;
        const clear = isOn(el, hit) && n.y + n.height / 2 < clearTop + gap;
        const underTip = !!hit && tipEl.contains(hit);
        if (clear) {
          checked.push(name(el));
          if (covered) revealed.push(name(el));
        } else if (underTip || covered) {
          checked.push(name(el));
          stuck.push(`${name(el)} (at ${Math.round(nx)},${Math.round(ny)} after scrolling; tip top ${Math.round(tip.y)})`);
        }
        for (const { s, top } of moved.reverse()) s.scrollTop = top;
        await frame();
      }
      return { tip, checked, revealed, stuck };
    },
    [[...hosts], CONTROLS] as const,
  );
}

/**
 * Fails when Booky's floating tip covers a control that scrolling cannot
 * bring clear of it. Expects a tip on screen unless `allowNone`. Returns the
 * report (e.g. to check something was revealed).
 */
export async function expectTipCoversNothing(c: Context, where: string, { allowNone = false } = {}): Promise<TipCover> {
  // Let the tip measure itself and the screen make room for it.
  await c.settle();
  await c.settle();
  const report = await tipCover(c.page);
  expect(allowNone || report.tip != null, `${where}: expected Booky's tip on screen to check`);
  expect(report.stuck.length === 0, `${where}: Booky's tip ${q(report.tip)} covers ${report.stuck.length} control(s) that scrolling cannot bring clear: ${report.stuck.join('; ')}`);
  c.logf(`${where}: tip ${report.tip ? `${Math.round(report.tip.y)}+${Math.round(report.tip.height)}` : 'none'}, ${report.checked.length} controls checked, ${report.revealed.length} revealed by scrolling`);
  return report;
}
