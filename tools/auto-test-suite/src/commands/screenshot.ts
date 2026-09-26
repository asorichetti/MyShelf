import { Command } from 'commander';

import { parseColorScheme, resolveViewport, type Size } from '../browser/browser.ts';
import { joinErrors } from '../errors.ts';
import { navigateOnce, type NavigateResult } from './navigate.ts';
import { emit, parseIntFlag, splitList } from './root.ts';

interface ScreenshotOpts {
  url: string;
  viewports: string;
  schemes: string;
  marker?: string;
  wait: number;
}

export function screenshotCommand(): Command {
  return new Command('screenshot')
    .description('Capture a viewport x color-scheme matrix; one fresh browser and bundle per combination')
    .option('--url <path>', 'path or absolute URL', '/')
    .option('--viewports <list>', 'comma-separated viewport presets', 'mobile,desktop')
    .option('--schemes <list>', 'comma-separated color schemes (light, dark, no-preference)', 'light,dark')
    .option('--marker <selector>', 'selector that means the page rendered (default: the page-content testid)')
    .option('--wait <ms>', 'extra milliseconds to wait before the traffic gates snapshot', parseIntFlag('--wait'), 0)
    .addHelpText('after', '\nExamples:\n  auto-test-suite screenshot --url / --viewports mobile,desktop --schemes light,dark')
    .action(async (opts: ScreenshotOpts) => {
      const start = Date.now();
      const vps = splitList(opts.viewports);
      const schemes = splitList(opts.schemes);
      if (schemes.length === 0) schemes.push('');
      for (const s of schemes) parseColorScheme(s); // fail before launching anything
      const sizes: Size[] = vps.map((v) => resolveViewport(v));
      const shots: NavigateResult[] = [];
      const errs: Error[] = [];
      for (const [i, vp] of sizes.entries()) {
        for (const scheme of schemes) {
          // A page's colour scheme is fixed at creation: new browser per combination.
          const name = `screenshot-${vps[i]}${scheme ? '-' + scheme : ''}`;
          const { result, error } = await navigateOnce(name, opts.url, vp, scheme, opts.marker ?? '', opts.wait, [vp]);
          shots.push(result);
          if (error) errs.push(new Error(`${name}: ${error.message}`));
        }
      }
      const err = joinErrors(errs);
      emit({ command: 'screenshot', ok: !err, url: opts.url, durationMs: Date.now() - start, shots });
      if (err) throw err;
    });
}
