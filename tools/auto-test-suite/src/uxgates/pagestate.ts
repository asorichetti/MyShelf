
import { errorMessage } from '../errors.ts';
import { Testids, tid } from '../selectors.ts';
import { newResult, truncate, type RawFinding, type Result } from './gate.ts';

import type { Page } from 'playwright';

export interface PageStateOptions {
  /** The selector that means "content rendered". Defaults to the shared page-content testid. */
  marker?: string;
  /** How long to wait for marker, in ms. Defaults to 15000. */
  timeoutMs?: number;
  /** The minimum visible text length inside <main>. Defaults to 10. */
  minMainText?: number;
}

const contentMarker = tid(Testids.pageState.content);
const errorMarker = tid(Testids.pageState.error);

// pageStateGate catches the blank screen that throws nothing: it fails when
// the content marker never appears, when the error marker appears instead, or
// when the visible main landmark carries almost no text.
export async function pageStateGate(page: Page, target: string, opts: PageStateOptions = {}): Promise<Result> {
  const start = Date.now();
  const marker = opts.marker || contentMarker;
  const timeoutMs = opts.timeoutMs || 15_000;
  const minMainText = opts.minMainText || 10;
  const findings: RawFinding[] = [];

  try {
    // Stack navigators keep the screens underneath in the DOM (hidden), each
    // with its own marker, so look for a visible one.
    await page.locator(`${marker}:visible, ${errorMarker}:visible`).first().waitFor({ state: 'visible', timeout: timeoutMs });
  } catch {
    const probe = await page
      .evaluate(() => ({
        url: location.href,
        title: document.title,
        bodyTextLength: ((document.body && document.body.innerText) || '').trim().length,
      }))
      .catch(() => ({ url: '', title: '', bodyTextLength: 0 }));
    findings.push({
      rule: 'content-marker',
      message: `content marker ${marker} not visible within ${timeoutMs / 1000}s`,
      evidence: { marker, url: probe.url, title: probe.title, bodyTextLength: probe.bodyTextLength },
    });
    return newResult('pagestate', target, start, findings);
  }

  const err = page.locator(`${errorMarker}:visible`).first();
  if ((await page.locator(`${errorMarker}:visible`).count().catch(() => 0)) > 0 && (await err.isVisible().catch(() => false))) {
    const txt = await err.innerText().catch(() => '');
    findings.push({
      rule: 'error-marker',
      message: `page rendered its error state: ${truncate(txt, 200)}`,
      evidence: { marker: errorMarker, text: txt },
    });
  }

  try {
    const main = await page.evaluate(() => {
      const mains = [...document.querySelectorAll<HTMLElement>('main, [role="main"]')].filter((el) =>
        el.checkVisibility ? el.checkVisibility() : el.offsetParent !== null,
      );
      if (!mains.length) return { found: false, textLength: 0 };
      return { found: true, textLength: (mains[0]!.innerText || '').trim().length };
    });
    if (main.found && main.textLength < minMainText) {
      findings.push({
        rule: 'main-text',
        message: `visible main has only ${main.textLength} characters of text (want >= ${minMainText})`,
        evidence: { textLength: main.textLength },
      });
    }
  } catch (e) {
    findings.push({ rule: 'evaluate', message: `could not inspect main: ${errorMessage(e)}` });
  }
  return newResult('pagestate', target, start, findings);
}
