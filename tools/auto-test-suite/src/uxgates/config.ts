// Gate configuration (gates.config.json) and the console allowlist
// (console_allowlist.json). Both ship with the tool and are validated at
// startup; --gates-config and --console-allowlist point at other copies.
import { readFileSync } from 'node:fs';

import defaultAllowlistJSON from './console_allowlist.json' with { type: 'json' };
import defaultConfigJSON from './gates.config.json' with { type: 'json' };

/**
 * Tunes the render and a11y gates for this app. Every disabled rule must carry
 * a reason: an unexplained exemption is how a real regression hides.
 */
export interface Config {
  render: RenderConfig;
  a11y: A11yConfig;
}

export interface RenderConfig {
  /** CSS custom properties that must resolve on :root. */
  requiredTokens: string[];
  /** Selectors that must have a non-zero, visible box. */
  landmarks: string[];
  /** Maps a render rule id to the reason it is off. */
  disabled: Record<string, string>;
}

export interface A11yConfig {
  /** The smallest touch target (width and height, CSS px) the target-size rule accepts. */
  minTargetSize: number;
  /** Maps an a11y rule id to the reason it is off. */
  disabled: Record<string, string>;
}

/** The target-size minimum when the config does not set one: the plan's 48 dp. */
export const DefaultMinTargetSize = 48;

/** Every rule id, so config typos are caught. */
export const RenderRules = [
  'stylesheets',
  'tokens',
  'body-margin',
  'body-background',
  'body-font',
  'text-font',
  'fonts-loaded',
  'fonts-error',
  'images',
  'overflow',
  'landmarks',
] as const;
export const A11yRules = [
  'one-h1',
  'heading-order',
  'img-alt',
  'accessible-name',
  'skip-link',
  'one-main',
  'nav-labels',
  'html-lang',
  'target-size',
] as const;

/** Silences one console error pattern. Both fields are required. */
export interface AllowRule {
  pattern: string;
  reason: string;
  re: RegExp;
}

// Parsed on first use (or by the CLI before any command runs), so an invalid
// shipped file is reported as a normal error instead of crashing at import.
let activeConfig: Config | undefined;
let activeAllowlist: AllowRule[] | undefined;

/** The configuration in use. */
export function getConfig(): Config {
  activeConfig ??= parseConfig(defaultConfigJSON, 'embedded gates.config.json');
  return activeConfig;
}

/** The console allowlist in use. */
export function getAllowlist(): AllowRule[] {
  activeAllowlist ??= parseAllowlist(defaultAllowlistJSON, 'embedded console_allowlist.json');
  return activeAllowlist;
}

/** Replaces the gate config from path, or the shipped default when path is empty. */
export function loadConfig(path = ''): void {
  activeConfig = path ? parseConfig(readJSON(path, 'gates config'), path) : parseConfig(defaultConfigJSON, 'embedded gates.config.json');
}

/** Replaces the console allowlist from path, or the shipped default when path is empty. */
export function loadAllowlist(path = ''): void {
  activeAllowlist = path
    ? parseAllowlist(readJSON(path, 'console allowlist'), path)
    : parseAllowlist(defaultAllowlistJSON, 'embedded console_allowlist.json');
}

function readJSON(path: string, what: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`read ${what} ${path}: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    throw new Error(`parse ${what} ${path}: ${(err as Error).message}`);
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Rejects keys that are not in allowed, so a misspelt section is not silently ignored. */
function onlyKeys(v: Record<string, unknown>, allowed: string[], where: string): void {
  for (const k of Object.keys(v)) {
    if (!allowed.includes(k)) throw new Error(`parse gates config: unknown field "${where}${k}" (known: ${allowed.join(', ')})`);
  }
}

function stringList(v: unknown, where: string): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
    throw new Error(`parse gates config: ${where} must be an array of strings`);
  }
  return [...v];
}

function disabledMap(v: unknown, gate: string, known: readonly string[]): Record<string, string> {
  if (v === undefined || v === null) return {};
  if (!isObject(v)) throw new Error(`parse gates config: ${gate}.disabled must be an object of rule -> reason`);
  const out: Record<string, string> = {};
  for (const [rule, reason] of Object.entries(v)) {
    if (!known.includes(rule)) throw new Error(`${gate}.disabled: unknown rule "${rule}" (known: ${known.join(', ')})`);
    if (typeof reason !== 'string') throw new Error(`parse gates config: ${gate}.disabled.${rule} must be a string reason`);
    if (reason.trim() === '') throw new Error(`${gate}.disabled.${rule}: a reason is required`);
    out[rule] = reason;
  }
  return out;
}

/** Validates a parsed gates config. Exported for tests. */
export function parseConfig(raw: unknown, source: string): Config {
  try {
    if (!isObject(raw)) throw new Error('parse gates config: top level must be an object');
    onlyKeys(raw, ['render', 'a11y'], '');
    const render = raw.render ?? {};
    const a11y = raw.a11y ?? {};
    if (!isObject(render)) throw new Error('parse gates config: render must be an object');
    if (!isObject(a11y)) throw new Error('parse gates config: a11y must be an object');
    onlyKeys(render, ['requiredTokens', 'landmarks', 'disabled'], 'render.');
    onlyKeys(a11y, ['minTargetSize', 'disabled'], 'a11y.');
    const minTarget = a11y.minTargetSize ?? DefaultMinTargetSize;
    if (typeof minTarget !== 'number' || !Number.isFinite(minTarget) || minTarget <= 0) {
      throw new Error('parse gates config: a11y.minTargetSize must be a positive number of CSS px');
    }
    const cfg: Config = {
      render: {
        requiredTokens: stringList(render.requiredTokens, 'render.requiredTokens'),
        landmarks: stringList(render.landmarks, 'render.landmarks'),
        disabled: disabledMap(render.disabled, 'render', RenderRules),
      },
      a11y: { minTargetSize: minTarget, disabled: disabledMap(a11y.disabled, 'a11y', A11yRules) },
    };
    for (const t of cfg.render.requiredTokens) {
      if (!t.startsWith('--')) throw new Error(`render.requiredTokens: "${t}" must be a CSS custom property (start with --)`);
    }
    return cfg;
  } catch (err) {
    throw new Error(`${source}: ${(err as Error).message}`);
  }
}

/** Validates a parsed console allowlist and compiles its patterns. Exported for tests. */
export function parseAllowlist(raw: unknown, source: string): AllowRule[] {
  if (!Array.isArray(raw)) throw new Error(`${source}: parse console allowlist: top level must be an array`);
  return raw.map((entry: unknown, i) => {
    if (!isObject(entry)) throw new Error(`${source}: console allowlist entry ${i}: must be an object`);
    for (const k of Object.keys(entry)) {
      if (k !== 'pattern' && k !== 'reason') throw new Error(`${source}: console allowlist entry ${i}: unknown field "${k}"`);
    }
    const { pattern, reason } = entry;
    if (typeof pattern !== 'string' || typeof reason !== 'string' || pattern.trim() === '' || reason.trim() === '') {
      throw new Error(`${source}: console allowlist entry ${i}: both pattern and reason are required`);
    }
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch (err) {
      throw new Error(`${source}: console allowlist entry ${i}: ${(err as Error).message}`);
    }
    return { pattern, reason, re };
  });
}

/** Disabled rules as "rule: reason", sorted, for a Result's skipped list. */
export function skippedList(disabled: Record<string, string>): string[] {
  return Object.entries(disabled)
    .map(([rule, reason]) => `${rule}: ${reason}`)
    .sort();
}
