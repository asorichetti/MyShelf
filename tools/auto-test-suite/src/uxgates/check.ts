
import { viewportName, type Size } from '../browser/browser.ts';
import { errorMessage, joinErrors } from '../errors.ts';
import { a11yGate } from './a11y.ts';
import { consoleGate } from './console.ts';
import { networkGate } from './network.ts';
import { pageStateGate, type PageStateOptions } from './pagestate.ts';
import { renderGate } from './render.ts';

import type { Recorder } from './gate.ts';
import type { Listeners } from '../browser/listeners.ts';
import type { Page } from 'playwright';

/** Waits for layout, not a clock: two animation frames. */
export async function twoFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

// checkPage runs the DOM gates for a page that has just been loaded:
// pagestate first, then render at every viewport in renderAt (the page is
// resized and restored, so sideways overflow is caught at the narrow width and
// media queries are exercised from both sides), then a11y.
//
// When pagestate fails, render and a11y are skipped: on a blank page they only
// add noise that hides the real cause. The traffic gates still run later.
//
// The returned error is set only in fail mode.
export async function checkPage(
  page: Page,
  rec: Recorder,
  target: string,
  ps: PageStateOptions,
  renderAt: readonly Size[],
): Promise<Error | undefined> {
  if (!rec.enabled()) return undefined;
  const state = await pageStateGate(page, target, ps);
  const stateErr = rec.add(state);
  if (stateErr || !state.pass) return stateErr;

  const errs: unknown[] = [];
  const orig = page.viewportSize();
  const sizes = renderAt.length === 0 && orig ? [orig] : renderAt;
  for (const vp of sizes) {
    const resized = orig !== null && (vp.width !== orig.width || vp.height !== orig.height);
    if (resized) {
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
      } catch (err) {
        errs.push(new Error(`resize to ${vp.width}x${vp.height}: ${errorMessage(err)}`));
        continue;
      }
      await twoFrames(page).catch(() => {});
    }
    errs.push(rec.add(await renderGate(page, `${target} @${viewportName(vp)}`)));
  }
  if (orig) {
    const cur = page.viewportSize();
    if (!cur || cur.width !== orig.width || cur.height !== orig.height) {
      try {
        await page.setViewportSize(orig);
      } catch (err) {
        errs.push(new Error(`restore viewport: ${errorMessage(err)}`));
      }
      await twoFrames(page).catch(() => {});
    }
  }
  errs.push(rec.add(await a11yGate(page, target)));
  return joinErrors(errs);
}

// checkTraffic runs the console and network gates over everything captured so
// far. Run it at the end, after assertions pass: a page that does the right
// thing while logging errors must still fail.
export function checkTraffic(l: Listeners, rec: Recorder, target: string): Error | undefined {
  if (!rec.enabled()) return undefined;
  return joinErrors([rec.add(consoleGate(l, target)), rec.add(networkGate(l, target))]);
}
