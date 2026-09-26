// The Chromium lifecycle: launch, one context + page per colour scheme,
// screenshots and a close that is safe in a finally block.
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { chromium, type Browser as PWBrowser, type BrowserContext, type Page } from 'playwright';

import { errorMessage } from '../errors.ts';
import { routeCovers } from './covers.ts';
import { activeMockApi, installMockApi } from '../mockapi/route.ts';

export interface Size {
  width: number;
  height: number;
}

// Viewport presets. The app is a React Native Web mobile app, so the CLI
// defaults to "mobile"; desktop and tablet exist to exercise layouts from both
// sides of a media query.
export const Viewports: Readonly<Record<string, Readonly<Size>>> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1280, height: 900 },
};

/** Overrides the preset height, e.g. to render a tall scroll container in one full-page screenshot. */
export const ViewportHeightEnv = 'AUTOTEST_VIEWPORT_HEIGHT';

/** The preset names in a stable order. */
export function viewportNames(): string[] {
  return Object.keys(Viewports).sort();
}

/** Maps a preset name to a size, applying AUTOTEST_VIEWPORT_HEIGHT. */
export function resolveViewport(name: string, env: NodeJS.ProcessEnv = process.env): Size {
  const vp = Viewports[name.trim().toLowerCase()];
  if (!vp) {
    throw new Error(`unknown viewport "${name}" (want one of ${viewportNames().join(', ')})`);
  }
  const out = { ...vp };
  const h = env[ViewportHeightEnv];
  if (h) {
    const n = Number(h);
    if (!/^\d+$/.test(h) || !Number.isSafeInteger(n) || n <= 0) {
      throw new Error(`${ViewportHeightEnv}="${h}" is not a positive integer`);
    }
    out.height = n;
  }
  return out;
}

/** The preset name for a size (matched on width), or WxH when it is custom. */
export function viewportName(vp: Size): string {
  for (const n of viewportNames()) {
    if (Viewports[n]!.width === vp.width) return n;
  }
  return `${vp.width}x${vp.height}`;
}

// defaultHeadless decides headless mode from display presence rather than from
// CI alone: containers have no display either, and a headed launch there fails
// in a way that looks like a bad flag.
export function defaultHeadless(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): boolean {
  if (env.CI) return true;
  if (env.DISPLAY || env.WAYLAND_DISPLAY) return false;
  return platform !== 'darwin'; // macOS draws via Quartz and sets neither
}

export type ColorScheme = 'light' | 'dark' | 'no-preference';

/** Parses --color-scheme; the empty string means "browser default". */
export function parseColorScheme(s: string): ColorScheme | undefined {
  const v = s.trim().toLowerCase();
  if (v === '') return undefined;
  if (v === 'light' || v === 'dark' || v === 'no-preference') return v;
  throw new Error(`unknown color scheme "${s}" (want light, dark or no-preference)`);
}

// tsx compiles this tool with esbuild's keepNames, which wraps named inner
// functions in a `__name(fn, "name")` helper. Functions passed to
// page.evaluate are serialized with toString() and run in the page, where that
// helper does not exist. Defining it as the identity function in every page
// (before any page script runs) keeps evaluate callbacks real, typechecked
// functions instead of strings.
export const EVALUATE_SHIM = 'globalThis.__name = globalThis.__name || function (fn) { return fn; };';

/** One Chromium process and the contexts opened on it. */
export class Browser {
  private browser: PWBrowser | undefined;
  private contexts: BrowserContext[] = [];

  private constructor(browser: PWBrowser) {
    this.browser = browser;
  }

  /** Launches Chromium. */
  static async launch(headless: boolean): Promise<Browser> {
    try {
      const b = await chromium.launch({
        headless,
        // Chromium keeps renderer shared memory in /dev/shm, which containers
        // cap at 64M; overrunning it crashes the tab before any step runs.
        args: ['--disable-dev-shm-usage'],
      });
      return new Browser(b);
    } catch (err) {
      throw new Error(
        `launch chromium (headless=${headless}; install it with \`npm run autotest:install-browser\`): ${errorMessage(err)}`,
      );
    }
  }

  // newPage opens a page in a fresh context. A page's colour scheme is fixed at
  // creation, so capturing light and dark needs one page per scheme.
  async newPage(viewport: Size, colorScheme: string): Promise<Page> {
    if (!this.browser) throw new Error('browser is closed');
    const scheme = parseColorScheme(colorScheme);
    const ctx = await this.browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: 'en-US',
      ...(scheme ? { colorScheme: scheme } : {}),
    });
    this.contexts.push(ctx);
    await ctx.addInitScript({ content: EVALUATE_SHIM });
    // API responses come from recorded fixtures and book covers from ./fixtures,
    // never from the internet (mockapi/, covers.ts). Without --mock-api only
    // covers are routed.
    const mock = activeMockApi();
    if (mock) await installMockApi(ctx, mock.index, mock.baseOrigin);
    else await routeCovers(ctx);
    return ctx.newPage();
  }

  // close tears everything down. It logs instead of throwing so it is safe in a
  // finally block.
  async close(): Promise<void> {
    for (const c of this.contexts) {
      try {
        await c.close();
      } catch (err) {
        process.stderr.write(`browser: close context: ${errorMessage(err)}\n`);
      }
    }
    this.contexts = [];
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        process.stderr.write(`browser: close chromium: ${errorMessage(err)}\n`);
      }
      this.browser = undefined;
    }
  }
}

/** Writes a full-page PNG to outPath, or dir/screenshot.png when outPath is empty. Returns the path written. */
export async function screenshot(page: Page, outPath: string, dir: string): Promise<string> {
  const p = outPath || join(dir, 'screenshot.png');
  await mkdir(dirname(p), { recursive: true });
  try {
    await page.screenshot({ path: p, fullPage: true });
  } catch (err) {
    throw new Error(`screenshot: ${errorMessage(err)}`);
  }
  return p;
}
