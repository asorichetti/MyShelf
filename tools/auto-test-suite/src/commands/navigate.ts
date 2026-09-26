import { Command } from 'commander';

import { viewportName, type Size } from '../browser/browser.ts';
import { RunBundle, RunStartError, emptyArtifacts, type Artifacts } from '../browser/run.ts';
import { errorMessage, joinErrors } from '../errors.ts';
import { checkPage, checkTraffic } from '../uxgates/check.ts';
import { Recorder, type Summary } from '../uxgates/gate.ts';
import { currentBaseURL, emit, g, gateMode, logf, parseIntFlag, renderViewports, resolveURL, viewport } from './root.ts';

export interface NavigateResult {
  command: string;
  ok: boolean;
  url: string;
  finalUrl?: string;
  status?: number;
  title?: string;
  viewport: string;
  colorScheme?: string;
  durationMs: number;
  error?: string;
  gates: Summary;
  gateFailures?: string[];
  artifacts: Artifacts;
}

export function navigateCommand(): Command {
  return new Command('navigate')
    .description('Open a URL, wait for it to settle, run the gates and capture a bundle')
    .option('--url <path>', 'path (joined to the base URL) or absolute URL', '/')
    .option(
      '--wait <ms>',
      'extra milliseconds to wait after the content marker appears, so async requests land before the gates snapshot',
      parseIntFlag('--wait'),
      0,
    )
    .option('--marker <selector>', 'selector that means the page rendered (default: the page-content testid)')
    .addHelpText(
      'after',
      `
Examples:
  auto-test-suite navigate --url /
  auto-test-suite navigate --url /nope__expected-404 --marker '[data-testid="expo-router-unmatched"]'
  auto-test-suite navigate --url / --wait 2000 --ux-gates fail`,
    )
    .action(async (opts: { url: string; wait: number; marker?: string }) => {
      const vp = viewport();
      const { result, error } = await navigateOnce('navigate', opts.url, vp, g.colorScheme, opts.marker ?? '', opts.wait, renderViewports(vp));
      emit(result);
      if (error) throw error;
    });
}

/** One fresh browser, one page, one bundle. */
export async function navigateOnce(
  name: string,
  path: string,
  vp: Size,
  scheme: string,
  marker: string,
  waitMs: number,
  renderAt: Size[],
): Promise<{ result: NavigateResult; error: Error | undefined }> {
  const start = Date.now();
  const target = resolveURL(currentBaseURL(), path);
  const rec = new Recorder(gateMode());
  let finalUrl: string | undefined;
  let status: number | undefined;
  let title: string | undefined;
  let artifacts = emptyArtifacts();
  let error: Error | undefined;

  const vpName = viewportName(vp);
  logf(`${name} ${target} (viewport ${vpName}, gates ${rec.mode})`);
  let run: RunBundle | undefined;
  try {
    run = await RunBundle.create(name, g.headless, g.screenshotDir, vp, scheme);
    run.gates = rec;
    const errs: unknown[] = [];
    const resp = await run.page.goto(target, { waitUntil: 'load' }).catch((err: unknown) => {
      throw new Error(`goto ${target}: ${errorMessage(err)}`);
    });
    if (resp) status = resp.status();
    errs.push(await checkPage(run.page, rec, path, { marker }, renderAt));
    if (!rec.enabled() && marker !== '') {
      await run.page
        .locator(marker)
        .first()
        .waitFor()
        .catch((err: unknown) => errs.push(new Error(`marker ${marker}: ${errorMessage(err)}`)));
    }
    if (waitMs > 0) {
      // Deliberate, documented: async work (a fetch in an effect) has not
      // landed when the content marker appears.
      await run.page.waitForTimeout(waitMs);
    }
    errs.push(checkTraffic(run.listeners, rec, path));
    finalUrl = run.page.url();
    title = await run.page.title().catch(() => '');
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

  const result: NavigateResult = {
    command: name,
    ok: !error,
    url: target,
    ...(finalUrl ? { finalUrl } : {}),
    ...(status ? { status } : {}),
    ...(title ? { title } : {}),
    viewport: vpName,
    ...(scheme ? { colorScheme: scheme } : {}),
    durationMs: Date.now() - start,
    ...(error ? { error: error.message } : {}),
    gates: rec.summary(),
    ...(rec.failures().length ? { gateFailures: rec.failures() } : {}),
    artifacts,
  };
  logf(`${name} ${target} -> ok=${result.ok} bundle=${artifacts.runDir}`);
  return { result, error };
}
