// Event listeners that capture console output, page errors and failed network
// traffic for the bundle and for the console/network gates.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';

import { errorMessage } from '../errors.ts';

/** One console message or uncaught page error. */
export interface ConsoleEntry {
  time: string;
  type: string; // log, warning, error, ..., or "pageerror"
  text: string;
  location?: string;
  isError: boolean;
}

/**
 * A failed request: a response with status >= 400, or a request that never got
 * a response (status 0 plus the failure text).
 */
export interface NetworkEntry {
  time: string;
  url: string;
  method: string;
  status: number;
  statusText?: string;
  resourceType?: string;
  failure?: string;
}

// Listeners records console output, page errors and failed network traffic.
// Successful traffic is dropped on purpose: a list of only failures is
// something a human will actually open. Playwright delivers events on the one
// JS thread, so no locking is needed.
export class Listeners {
  private console: ConsoleEntry[] = [];
  private network: NetworkEntry[] = [];

  // attach wires the listeners onto a page. Call it before navigating; anything
  // that fires before attach returns is lost.
  static attach(page: Page): Listeners {
    const l = new Listeners();
    page.on('console', (m) => {
      const e: ConsoleEntry = { time: now(), type: m.type(), text: m.text(), isError: m.type() === 'error' };
      const loc = m.location();
      if (loc && loc.url) e.location = `${loc.url}:${loc.lineNumber + 1}:${loc.columnNumber + 1}`;
      l.console.push(orderConsole(e));
    });
    page.on('pageerror', (err) => {
      l.console.push({ time: now(), type: 'pageerror', text: err.message || String(err), isError: true });
    });
    page.on('response', (r) => {
      if (r.status() < 400) return;
      const req = r.request();
      l.network.push({
        time: now(),
        url: r.url(),
        method: req.method(),
        status: r.status(),
        ...(r.statusText() ? { statusText: r.statusText() } : {}),
        ...(req.resourceType() ? { resourceType: req.resourceType() } : {}),
      });
    });
    page.on('requestfailed', (r) => {
      const failure = r.failure()?.errorText;
      l.network.push({
        time: now(),
        url: r.url(),
        method: r.method(),
        status: 0,
        ...(r.resourceType() ? { resourceType: r.resourceType() } : {}),
        ...(failure ? { failure } : {}),
      });
    });
    return l;
  }

  /** Copies, so gates can read without draining what the JSON dump will later write. */
  snapshot(): { console: ConsoleEntry[]; network: NetworkEntry[] } {
    return { console: this.console.map((e) => ({ ...e })), network: this.network.map((e) => ({ ...e })) };
  }

  /** Writes console.json and network.json into dir. */
  async writeJSON(dir: string): Promise<{ consolePath: string; networkPath: string }> {
    const { console: c, network: n } = this.snapshot();
    const consolePath = join(dir, 'console.json');
    const networkPath = join(dir, 'network.json');
    await writeJSONFile(consolePath, c);
    await writeJSONFile(networkPath, n);
    return { consolePath, networkPath };
  }
}

// Keeps the key order of the JSON stable (location before isError).
function orderConsole(e: ConsoleEntry): ConsoleEntry {
  return { time: e.time, type: e.type, text: e.text, ...(e.location ? { location: e.location } : {}), isError: e.isError };
}

function now(): string {
  return new Date().toISOString();
}

/** Writes v as indented JSON; a failed write (or flush) is reported with the path. */
export async function writeJSONFile(path: string, v: unknown): Promise<void> {
  try {
    await writeFile(path, JSON.stringify(v, null, 2) + '\n');
  } catch (err) {
    throw new Error(`write ${path}: ${errorMessage(err)}`);
  }
}
