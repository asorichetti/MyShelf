// The per-run evidence bundle: one browser, one page, its listeners and a
// fresh run directory that always ends up holding five files.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';


import { errorMessage, joinErrors } from '../errors.ts';
import { Browser, screenshot, type Size } from './browser.ts';
import { Listeners, writeJSONFile } from './listeners.ts';

import type { Page } from 'playwright';

/** The five files every browser command leaves behind. */
export interface Artifacts {
  runDir: string;
  screenshot: string;
  html: string;
  console: string;
  network: string;
  uxgates: string;
}

export function emptyArtifacts(runDir = ''): Artifacts {
  return { runDir, screenshot: '', html: '', console: '', network: '', uxgates: '' };
}

// GatesWriter is declared structurally so uxgates (which imports browser) can
// satisfy it without an import cycle.
export interface GatesWriter {
  writeJSON(dir: string): Promise<string>;
}

const unsafeName = /[^A-Za-z0-9._-]+/g;

/** One browser, one page, its listeners and its run directory. */
export class RunBundle {
  gates: GatesWriter | undefined;
  private finished = false;
  private artifacts: Artifacts;

  private constructor(
    readonly name: string,
    readonly dir: string,
    readonly viewport: Size,
    readonly scheme: string,
    readonly browser: Browser,
    readonly page: Page,
    readonly listeners: Listeners,
  ) {
    this.artifacts = emptyArtifacts(dir);
  }

  // create makes <dir>/<cmdName>-<unixMillis>/, launches a fresh browser and
  // page, and attaches listeners before anything navigates. When the browser
  // does not start, the run directory still gets an explanation and the error
  // carries its path.
  static async create(cmdName: string, headless: boolean, dir: string, vp: Size, scheme: string): Promise<RunBundle> {
    const runDir = await makeRunDir(dir, cmdName);
    let browser: Browser;
    try {
      browser = await Browser.launch(headless);
    } catch (err) {
      await writePlaceholder(runDir, err);
      throw new RunStartError(errorMessage(err), runDir);
    }
    let page: Page;
    try {
      page = await browser.newPage(vp, scheme);
    } catch (err) {
      await writePlaceholder(runDir, err);
      await browser.close();
      throw new RunStartError(errorMessage(err), runDir);
    }
    return new RunBundle(cmdName, runDir, vp, scheme, browser, page, Listeners.attach(page));
  }

  // finish writes the bundle: screenshot.png, page.html, console.json,
  // network.json and uxgates.json. It keeps writing after an individual failure
  // so a broken page still leaves as much evidence as possible.
  async finish(): Promise<{ artifacts: Artifacts; error: Error | undefined }> {
    const a = emptyArtifacts(this.dir);
    const errs: unknown[] = [];
    a.html = join(this.dir, 'page.html');
    if (!this.page.isClosed()) {
      try {
        a.screenshot = await screenshot(this.page, '', this.dir);
      } catch (err) {
        errs.push(err);
      }
      let html: string;
      try {
        html = await this.page.content();
      } catch (err) {
        errs.push(new Error(`page content: ${errorMessage(err)}`));
        html = `<!-- auto-test-suite: could not read page content: ${errorMessage(err)} -->\n`;
      }
      try {
        await writeFile(a.html, html);
      } catch (err) {
        errs.push(err);
      }
    } else {
      errs.push(new Error('page is closed; no screenshot or DOM'));
      await writeFile(a.html, '<!-- auto-test-suite: page was closed before capture -->\n').catch(() => {});
    }
    try {
      const { consolePath, networkPath } = await this.listeners.writeJSON(this.dir);
      a.console = consolePath;
      a.network = networkPath;
    } catch (err) {
      errs.push(err);
    }
    if (this.gates) {
      try {
        a.uxgates = await this.gates.writeJSON(this.dir);
      } catch (err) {
        errs.push(err);
      }
    } else {
      a.uxgates = join(this.dir, 'uxgates.json');
      try {
        await writeJSONFile(a.uxgates, { mode: 'off', results: [] });
      } catch (err) {
        errs.push(err);
      }
    }
    this.artifacts = a;
    const error = joinErrors(errs);
    // Only now: a partial failure must leave close() free to retry.
    if (!error) this.finished = true;
    return { artifacts: a, error };
  }

  /** finish for finally blocks: errors go to stderr. */
  async finishOrLog(): Promise<Artifacts> {
    const { artifacts, error } = await this.finish();
    if (error) process.stderr.write(`bundle ${this.dir}: ${error.message}\n`);
    return artifacts;
  }

  /** What the last finish wrote. */
  lastArtifacts(): Artifacts {
    return this.artifacts;
  }

  // close writes the bundle if nothing else did, then shuts the browser down.
  // A run directory must never come back empty.
  async close(): Promise<void> {
    if (!this.finished) await this.finishOrLog();
    await this.browser.close();
  }
}

/** A run whose browser or page never started. runDir holds the placeholder bundle. */
export class RunStartError extends Error {
  constructor(
    message: string,
    readonly runDir: string,
  ) {
    super(message);
    this.name = 'RunStartError';
  }
}

// makeRunDir creates a timestamped directory that never collides with an
// earlier run, even when two runs start in the same millisecond.
export async function makeRunDir(dir: string, cmdName: string): Promise<string> {
  const abs = resolve(dir);
  try {
    await mkdir(abs, { recursive: true });
  } catch (err) {
    throw new Error(`create screenshot dir: ${errorMessage(err)}`);
  }
  const base = `${cmdName.replace(unsafeName, '_')}-${Date.now()}`;
  for (let i = 0; i < 1000; i++) {
    const p = join(abs, i === 0 ? base : `${base}-${i}`);
    try {
      await mkdir(p);
      return p;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw new Error(`create run dir: ${errorMessage(err)}`);
      }
    }
  }
  throw new Error(`could not allocate a run dir under ${abs}`);
}

// writePlaceholder leaves an explanation in a run dir whose browser never
// started, so even that failure has a bundle.
async function writePlaceholder(runDir: string, cause: unknown): Promise<void> {
  const msg = errorMessage(cause);
  await Promise.allSettled([
    writeFile(join(runDir, 'page.html'), `<!-- auto-test-suite: browser did not start: ${msg} -->\n`),
    writeJSONFile(join(runDir, 'console.json'), []),
    writeJSONFile(join(runDir, 'network.json'), []),
    writeJSONFile(join(runDir, 'uxgates.json'), { error: msg, results: [] }),
  ]);
}
