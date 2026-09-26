import { Argument, Command } from 'commander';

import { RunBundle, RunStartError, emptyArtifacts, type Artifacts } from '../browser/run.ts';
import { errorMessage, joinErrors } from '../errors.ts';
import { tid } from '../selectors.ts';
import { currentBaseURL, emit, g, gateMode, parseIntFlag, resolveURL, viewport } from './root.ts';
import { checkPage, checkTraffic } from '../uxgates/check.ts';
import { Recorder, type Summary } from '../uxgates/gate.ts';

const actions = ['click', 'fill', 'press', 'focus'] as const;
type Action = (typeof actions)[number];

interface InteractOpts {
  url: string;
  selector?: string;
  testid?: string;
  value?: string;
  key?: string;
  marker?: string;
  settle: number;
}

interface InteractResult {
  command: 'interact';
  ok: boolean;
  action: Action;
  url: string;
  selector?: string;
  finalUrl?: string;
  after?: Record<string, unknown>;
  error?: string;
  durationMs: number;
  gates: Summary;
  gateFailures?: string[];
  artifacts: Artifacts;
}

export function interactCommand(): Command {
  return new Command('interact')
    .description('Perform one action on a page and capture the result (anything worth checking twice becomes a journey)')
    .addArgument(new Argument('<action>', 'click, fill, press or focus').choices(actions))
    .option('--url <path>', 'page to open first', '/')
    .option('--selector <selector>', 'Playwright selector of the target element')
    .option('--testid <id>', 'data-testid of the target element (shorthand for --selector \'[data-testid="..."]\')')
    .option('--value <text>', 'text for fill')
    .option('--key <key>', 'key for press, e.g. Tab, Enter, Escape, ArrowDown')
    .option('--marker <selector>', 'selector that means the page rendered (default: the page-content testid)')
    .option('--settle <ms>', 'milliseconds to let the UI settle after the action', parseIntFlag('--settle'), 300)
    .addHelpText(
      'after',
      `
Examples:
  auto-test-suite interact click --url / --testid home-title
  auto-test-suite interact fill  --url /search --selector 'input[name=q]' --value dune
  auto-test-suite interact press --url / --key Tab
  auto-test-suite interact focus --url / --testid home-title`,
    )
    .action(async (action: Action, opts: InteractOpts) => {
      const res = await interact(action, opts);
      emit(res.result);
      if (res.error) throw res.error;
    });
}

async function interact(action: Action, o: InteractOpts): Promise<{ result: InteractResult; error: Error | undefined }> {
  const start = Date.now();
  const target = resolveURL(currentBaseURL(), o.url);
  const sel = o.testid ? tid(o.testid) : (o.selector ?? '');
  const key = o.key ?? '';
  const rec = new Recorder(gateMode());
  let artifacts = emptyArtifacts();
  let finalUrl: string | undefined;
  let after: Record<string, unknown> | undefined;
  let error: Error | undefined;
  let run: RunBundle | undefined;
  try {
    if ((action === 'click' || action === 'fill' || action === 'focus') && !sel) {
      throw new Error(`interact ${action} needs --selector or --testid`);
    }
    if (action === 'press' && !key) throw new Error('interact press needs --key');
    const vp = viewport();
    run = await RunBundle.create(`interact-${action}`, g.headless, g.screenshotDir, vp, g.colorScheme);
    run.gates = rec;
    const page = run.page;
    try {
      await page.goto(target, { waitUntil: 'load' });
    } catch (err) {
      throw new Error(`goto ${target}: ${errorMessage(err)}`);
    }
    const errs: unknown[] = [];
    errs.push(await checkPage(page, rec, o.url, { marker: o.marker ?? '' }, [vp]));
    if (!rec.enabled() && sel) {
      try {
        await page.locator(sel).first().waitFor();
      } catch (err) {
        throw new Error(`${sel} never appeared: ${errorMessage(err)}`);
      }
    }
    const loc = page.locator(sel || 'body').first();
    try {
      switch (action) {
        case 'click':
          await loc.click();
          break;
        case 'fill':
          await loc.fill(o.value ?? '');
          break;
        case 'focus':
          await loc.focus();
          break;
        case 'press':
          if (sel) await loc.press(key);
          else await page.keyboard.press(key);
          break;
      }
    } catch (err) {
      throw new Error(`${action} ${sel}: ${errorMessage(err)}`);
    }
    // A short settle after an interaction is the one allowed fixed wait.
    if (o.settle > 0) await page.waitForTimeout(o.settle);
    const focus = await page
      .evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || a === document.body) return { activeElement: 'body' };
        const attrs: Record<string, string | null> = {};
        for (const n of ['data-testid', 'role', 'aria-selected', 'aria-expanded', 'aria-current', 'aria-checked', 'aria-pressed']) {
          if (a.hasAttribute(n)) attrs[n] = a.getAttribute(n);
        }
        return { activeElement: a.tagName.toLowerCase(), attributes: attrs, text: (a.innerText || '').slice(0, 80) };
      })
      .catch(() => undefined);
    after = focus ? { focus } : {};
    finalUrl = page.url();
    errs.push(checkTraffic(run.listeners, rec, o.url));
    error = joinErrors(errs);
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    if (err instanceof RunStartError) artifacts = emptyArtifacts(err.runDir);
  } finally {
    if (run) {
      artifacts = await run.finishOrLog();
      await run.close();
    }
  }
  const failures = rec.failures();
  const result: InteractResult = {
    command: 'interact',
    ok: !error,
    action,
    url: target,
    ...(sel ? { selector: sel } : {}),
    ...(finalUrl ? { finalUrl } : {}),
    ...(after && Object.keys(after).length ? { after } : {}),
    ...(error ? { error: error.message } : {}),
    durationMs: Date.now() - start,
    gates: rec.summary(),
    ...(failures.length ? { gateFailures: failures } : {}),
    artifacts,
  };
  return { result, error };
}
