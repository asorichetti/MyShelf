// The self-registering journey registry and runner. Each journey lives in a
// `*.journey.ts` file in this directory and calls register() when imported;
// loadJourneys() imports every such file, so there is no central list to
// forget. Each journey gets a fresh browser, page and run directory.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Page } from 'playwright';

import { screenshot, type Size } from '../browser/browser.ts';
import type { Listeners } from '../browser/listeners.ts';
import { RunBundle, RunStartError, emptyArtifacts, type Artifacts } from '../browser/run.ts';
import { errorMessage, joinErrors } from '../errors.ts';
import { Testids, tid } from '../selectors.ts';
import { checkPage, checkTraffic } from '../uxgates/check.ts';
import { Recorder, type Mode, type Summary } from '../uxgates/gate.ts';

/** One scripted user path with assertions. run throws (usually via expect) to fail. */
export interface Journey {
  name: string;
  suite: string;
  desc: string;
  run: (c: Context) => Promise<void>;
}

const registry = new Map<string, Journey>();

// register adds a journey. A duplicate name can only come from a copy-paste,
// so it throws at load time rather than reaching a run.
export function register(j: Journey): void {
  if (!j.name || !j.suite || !j.desc || typeof j.run !== 'function') {
    throw new Error(`journeys: incomplete journey ${JSON.stringify({ name: j.name, suite: j.suite, desc: j.desc })}`);
  }
  if (registry.has(j.name)) throw new Error(`journeys: duplicate journey name ${j.name}`);
  registry.set(j.name, j);
}

/** Every journey sorted by name, so runs are reproducible. */
export function all(): Journey[] {
  return [...registry.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** One journey by name. */
export function get(name: string): Journey | undefined {
  return registry.get(name);
}

let loaded: Promise<void> | undefined;

/** Imports every `*.journey.ts` file next to this one (once). */
export function loadJourneys(): Promise<void> {
  loaded ??= (async () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.journey.ts'))
      .sort();
    for (const f of files) await import(pathToFileURL(join(dir, f)).href);
  })();
  return loaded;
}

/** The shared "content rendered" marker. */
export const defaultMarker = tid(Testids.pageState.content);

/** An assertion failure: its message must make sense without opening the source. */
export class ExpectationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpectationError';
  }
}

// expect throws a readable error when cond is false, e.g.
// `/: expected h1 "MyShelf", found "MyShelff"`. Build messages with q() for
// quoted values.
export function expect(cond: boolean, message: string): asserts cond {
  if (!cond) throw new ExpectationError(message);
}

/** Quotes a value for an expect message, like Go's %q. */
export function q(v: unknown): string {
  return JSON.stringify(v);
}

/** What a journey sees. */
export class Context {
  /** Gate errors collected by goto in fail mode; reported after the journey. */
  readonly gateErrs: Error[] = [];

  constructor(
    readonly page: Page,
    readonly baseURL: string,
    readonly gates: Recorder,
    readonly listeners: Listeners,
    readonly viewport: Size,
    readonly runDir: string,
    /** Where goto runs the render gate (current viewport plus the other end of the width range). */
    readonly renderAt: Size[],
    readonly logf: (msg: string) => void,
  ) {}

  /** Joins a path onto the base URL. */
  url(path: string): string {
    return this.baseURL + (path.startsWith('/') ? path : '/' + path);
  }

  /** Navigates and runs the pagestate, render and a11y gates, waiting on the shared page-content marker. */
  goto(path: string): Promise<void> {
    return this.gotoMarker(path, '');
  }

  /** goto with a different "rendered" marker, for screens the app does not own (the framework's not-found screen). */
  async gotoMarker(path: string, marker: string): Promise<void> {
    this.logf(`goto ${path}`);
    try {
      await this.page.goto(this.url(path), { waitUntil: 'load' });
    } catch (err) {
      throw new Error(`goto ${path}: ${errorMessage(err)}`);
    }
    if (this.gates.enabled()) {
      const err = await checkPage(this.page, this.gates, path, { marker }, this.renderAt);
      if (err) this.gateErrs.push(err);
      return;
    }
    const m = marker || defaultMarker;
    try {
      await this.page.locator(m).first().waitFor();
    } catch (err) {
      throw new Error(`${path}: marker ${m} never appeared: ${errorMessage(err)}`);
    }
  }

  /** Writes an extra named screenshot into the run directory. */
  snap(name: string): Promise<string> {
    return screenshot(this.page, join(this.runDir, `${name.replace(/[^A-Za-z0-9._-]+/g, '_')}.png`), this.runDir);
  }

  /** Waits two animation frames: layout after a resize, not a clock. */
  async settle(): Promise<void> {
    await this.page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  }
}

/** Configures a journey run. */
export interface Options {
  baseURL: string;
  headless: boolean;
  screenshotDir: string;
  viewport: Size;
  colorScheme: string;
  mode: Mode;
  renderAt: Size[];
}

/** One journey's outcome plus where its evidence is. */
export interface JourneyResult {
  name: string;
  suite: string;
  ok: boolean;
  error?: string;
  durationMs: number;
  gates: Summary;
  gateFailures?: string[];
  artifacts: Artifacts;
}

// A programming error inside a journey (not a failed expectation or a
// Playwright error) gets its stack, like a Go panic would.
function describeJourneyError(err: unknown): Error {
  if (err instanceof TypeError || err instanceof ReferenceError || err instanceof RangeError || err instanceof SyntaxError) {
    return new Error(`journey threw ${err.name}: ${err.message}\n${err.stack ?? ''}`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

// runOne runs a journey in a fresh browser with its own run directory. The
// console and network gates run at the end, after the assertions.
export async function runOne(j: Journey, o: Options): Promise<JourneyResult> {
  const start = Date.now();
  const rec = new Recorder(o.mode);
  const logf = (msg: string) => process.stderr.write(`  [${j.name}] ${msg}\n`);
  let artifacts = emptyArtifacts();
  const errs: unknown[] = [];
  let run: RunBundle | undefined;
  try {
    run = await RunBundle.create(`journey-${j.name}`, o.headless, o.screenshotDir, o.viewport, o.colorScheme);
    run.gates = rec;
    const c = new Context(run.page, o.baseURL, rec, run.listeners, o.viewport, run.dir, o.renderAt, logf);
    try {
      await j.run(c);
    } catch (err) {
      errs.push(describeJourneyError(err));
    }
    errs.push(...c.gateErrs);
    errs.push(checkTraffic(run.listeners, rec, j.name));
  } catch (err) {
    errs.push(err);
    if (err instanceof RunStartError) artifacts = emptyArtifacts(err.runDir);
  } finally {
    if (run) {
      artifacts = await run.finishOrLog();
      await run.close();
    }
  }
  const error = joinErrors(errs);
  const failures = rec.failures();
  return {
    name: j.name,
    suite: j.suite,
    ok: !error,
    ...(error ? { error: error.message } : {}),
    durationMs: Date.now() - start,
    gates: rec.summary(),
    ...(failures.length ? { gateFailures: failures } : {}),
    artifacts,
  };
}
