// Shared state and helpers for the commands. Every command prints exactly one
// JSON document on stdout; human progress goes to stderr.
import { Viewports, resolveViewport, type Size } from '../browser/browser.ts';
import { parseMode, type Mode } from '../uxgates/gate.ts';

/** Maps --env to a base URL. */
export const Environments: Readonly<Record<string, string>> = {
  local: 'http://localhost:8081',
};

/** The resolved global flags, set once before any command runs. */
export interface GlobalOpts {
  env: string;
  baseUrl: string;
  headless: boolean;
  screenshotDir: string;
  uxGates: string;
  viewport: string;
  colorScheme: string;
  gatesConfig: string;
  consoleAllowlist: string;
  /** --mock-api: fixture directory, '' for the default, or 'off'. */
  mockApi: string;
}

export const g: GlobalOpts = {
  env: 'local',
  baseUrl: '',
  headless: true,
  screenshotDir: './screenshots',
  uxGates: 'warn',
  viewport: 'mobile',
  colorScheme: '',
  gatesConfig: '',
  consoleAllowlist: '',
  mockApi: '',
};

let emitted = false;

/** Whether a command already printed its result. */
export function hasEmitted(): boolean {
  return emitted;
}

/** Prints v as the command's single JSON result. */
export function emit(v: unknown): void {
  emitted = true;
  process.stdout.write(JSON.stringify(v, null, 2) + '\n');
}

/** Writes human progress to stderr. */
export function logf(msg: string): void {
  process.stderr.write(`auto-test-suite: ${msg}\n`);
}

/** The base URL from --base-url, else from --env, without a trailing slash. */
export function baseURL(env: string, override: string): string {
  let raw = override;
  if (raw === '') {
    const u = Environments[env];
    if (u === undefined) throw new Error(`unknown --env "${env}"`);
    raw = u;
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`invalid base URL "${raw}"`);
  }
  if (!u.protocol || !u.host) throw new Error(`invalid base URL "${raw}"`);
  return raw.replace(/\/+$/, '');
}

/** Joins a path onto the base URL; absolute URLs pass through. */
export function resolveURL(base: string, p: string): string {
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return base + (p.startsWith('/') ? p : '/' + p);
}

/** The base URL for the current global flags (validated before any command runs). */
export function currentBaseURL(): string {
  return baseURL(g.env, g.baseUrl);
}

export function gateMode(): Mode {
  return parseMode(g.uxGates);
}

export function viewport(): Size {
  return resolveViewport(g.viewport);
}

// renderViewports is where the render gate runs for every page: the selected
// viewport plus the other end of the range, so overflow at the narrow width and
// layout at the wide one are both checked.
export function renderViewports(current: Size): Size[] {
  const mobile = { ...Viewports.mobile! };
  const desktop = { ...Viewports.desktop! };
  if (current.height > 0) {
    mobile.height = current.height;
    desktop.height = current.height;
  }
  switch (current.width) {
    case mobile.width:
      return [current, desktop];
    case desktop.width:
      return [current, mobile];
    default:
      return [current, mobile, desktop];
  }
}

/** Splits a comma-separated flag value, dropping empty entries. */
export function splitList(s: string): string[] {
  return s
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '');
}

/** Parses an integer flag strictly (commander hands every value over as a string). */
export function parseIntFlag(flag: string): (v: string) => number {
  return (v: string) => {
    if (!/^-?\d+$/.test(v.trim())) throw new Error(`invalid argument "${v}" for "${flag}": not an integer`);
    return Number(v.trim());
  };
}

/** Parses --headless / --headless=true|false. */
export function parseBoolFlag(v: string | boolean): boolean {
  if (typeof v === 'boolean') return v;
  switch (v.trim().toLowerCase()) {
    case '':
    case 'true':
    case '1':
    case 't':
      return true;
    case 'false':
    case '0':
    case 'f':
      return false;
  }
  throw new Error(`invalid argument "${v}" for "--headless": want true or false`);
}
