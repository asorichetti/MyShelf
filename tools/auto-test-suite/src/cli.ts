// auto-test-suite drives the MyShelf web build in Chromium and leaves an
// evidence bundle behind for every run. See README.md.
import { Command, CommanderError, Option } from 'commander';

import { defaultHeadless, parseColorScheme, resolveViewport, viewportNames } from './browser/browser.ts';
import { interactCommand } from './commands/interact.ts';
import { journeyCommand } from './commands/journey.ts';
import { navigateCommand } from './commands/navigate.ts';
import { Environments, baseURL, emit, g, hasEmitted, logf, parseBoolFlag } from './commands/root.ts';
import { screenshotCommand } from './commands/screenshot.ts';
import { smokeCommand } from './commands/smoke.ts';
import { errorMessage } from './errors.ts';
import { loadJourneys } from './journeys/registry.ts';
import { startStaticServer, type StaticServer } from './server/static.ts';
import { loadAllowlist, loadConfig } from './uxgates/config.ts';
import { parseMode } from './uxgates/gate.ts';

const NAME = 'auto-test-suite';

/** The command being run, for the JSON error document. */
let current = NAME;

/** The --serve server, stopped when the command ends. */
let served: StaticServer | undefined;

interface RawGlobals {
  env: string;
  baseUrl: string;
  headless: boolean;
  screenshotDir: string;
  uxGates: string;
  viewport: string;
  colorScheme: string;
  gatesConfig: string;
  consoleAllowlist: string;
  serve: string;
}

function buildProgram(): Command {
  const program = new Command(NAME)
    .description(
      `${NAME} drives the MyShelf web build in Chromium. Every browser command writes a bundle ` +
        '(screenshot.png, page.html, console.json, network.json, uxgates.json) to a fresh run directory, ' +
        'prints one JSON document on stdout, and exits non-zero on failure. Progress goes to stderr.',
    )
    .option('--env <name>', `target environment (${Object.keys(Environments).sort().join(', ')})`, 'local')
    .addOption(new Option('--base-url <url>', 'base URL; overrides --env').default('', 'from --env'))
    .addOption(
      new Option('--serve <dir>', 'serve a static web export (e.g. dist) on a free local port and test that').default('', 'off'),
    )
    .addOption(
      new Option('--headless [bool]', 'run Chromium headless; --headless=false for a visible window')
        .preset(true)
        .default(defaultHeadless(), 'true in CI or without a display; false on macOS')
        .argParser(parseBoolFlag),
    )
    .option('--screenshot-dir <dir>', 'parent directory for per-run bundles', './screenshots')
    .option('--ux-gates <mode>', 'gate mode: off, warn or fail', 'warn')
    .option('--viewport <preset>', `viewport preset: ${viewportNames().join(', ')}`, 'mobile')
    .addOption(
      new Option('--color-scheme <scheme>', 'emulated color scheme: light, dark or no-preference').default('', 'browser default'),
    )
    .addOption(new Option('--gates-config <path>', 'path to a gates config JSON').default('', 'the shipped gates.config.json'))
    .addOption(
      new Option('--console-allowlist <path>', 'path to a console allowlist JSON').default('', 'the shipped console_allowlist.json'),
    )
    .exitOverride()
    .configureOutput({
      // Errors are reported once, as JSON on stdout plus one stderr line, by main().
      outputError: () => {},
    })
    .showHelpAfterError(false);

  const explicit = (flag: 'headless' | 'uxGates' | 'env' | 'baseUrl') => program.getOptionValueSource(flag) === 'cli';

  for (const sub of [navigateCommand(), journeyCommand(), smokeCommand(explicit), screenshotCommand(), interactCommand()]) {
    program.addCommand(sub.exitOverride().configureOutput({ outputError: () => {} }));
  }

  program.hook('preSubcommand', (_this, sub) => {
    current = sub.name();
  });
  program.hook('preAction', async () => {
    const { serve, ...o } = program.opts<RawGlobals>();
    Object.assign(g, o);
    loadConfig(g.gatesConfig);
    loadAllowlist(g.consoleAllowlist);
    parseMode(g.uxGates);
    resolveViewport(g.viewport);
    parseColorScheme(g.colorScheme);
    if (serve) {
      if (explicit('baseUrl') || explicit('env')) throw new Error('--serve and --base-url/--env are mutually exclusive');
      served = await startStaticServer(serve);
      g.baseUrl = served.url;
      logf(`serving ${serve} at ${served.url}`);
    }
    baseURL(g.env, g.baseUrl);
  });
  return program;
}

// main runs the CLI and sets a non-zero exit code on failure. If a command
// failed before printing its result, a minimal JSON error document is printed
// so stdout is always JSON.
async function main(): Promise<void> {
  const program = buildProgram();
  try {
    await loadJourneys();
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof CommanderError && (err.code === 'commander.helpDisplayed' || err.code === 'commander.version')) {
      return; // --help: usage on stdout, exit 0
    }
    let msg = errorMessage(err).replace(/^error: /, '');
    if (err instanceof CommanderError && err.code === 'commander.help') msg = 'no command given (see --help)';
    if (!hasEmitted()) emit({ command: current, ok: false, error: msg });
    logf(`error: ${msg}`);
    process.exitCode = 1;
  } finally {
    await served?.close();
  }
}

await main();
