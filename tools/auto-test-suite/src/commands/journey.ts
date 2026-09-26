import { Command } from 'commander';

import { currentBaseURL, emit, g, gateMode, logf, renderViewports, viewport } from './root.ts';
import { all, get, runOne, type Journey, type JourneyResult } from '../journeys/registry.ts';

export interface JourneySelection {
  all?: boolean;
  suite?: string;
  list?: boolean;
  grep?: string;
}

export function journeyCommand(): Command {
  return new Command('journey')
    .description('Run journeys by name, --suite, --grep or --all; --list prints the registry')
    .argument('[name...]', 'journey names')
    .option('--all', 'run every journey', false)
    .option('--suite <suite>', 'run every journey in this suite')
    .option('--list', 'print the selected journeys (all when nothing is selected) instead of running them', false)
    .option('--grep <regexp>', 'run journeys whose name or description matches this regexp')
    .addHelpText(
      'after',
      `
Examples:
  auto-test-suite journey --list
  auto-test-suite journey home-loads
  auto-test-suite journey --suite core --ux-gates fail
  auto-test-suite journey --grep home --viewport desktop
  auto-test-suite journey --all`,
    )
    .action(async (names: string[], opts: JourneySelection) => {
      const { selected, label } = selectJourneys(names, opts);
      if (opts.list) {
        const items = selected.map((j) => ({ name: j.name, suite: j.suite, desc: j.desc }));
        for (const j of selected) logf(`${j.name.padEnd(18)} ${j.suite.padEnd(11)} ${j.desc}`);
        emit({ command: 'journey', ok: true, list: true, selection: label, journeys: items });
        return;
      }
      await runJourneys('journey', selected, label);
    });
}

/** Resolves names / --all / --suite / --grep / --list into journeys plus a label for the output. */
export function selectJourneys(names: string[], opts: JourneySelection): { selected: Journey[]; label: string } {
  const everything = all();
  let out: Journey[];
  const labels: string[] = [];
  if (names.length > 0) {
    out = names.map((n) => {
      const j = get(n);
      if (!j) throw new Error(`unknown journey "${n}" (known: ${everything.map((k) => k.name).join(', ')})`);
      return j;
    });
    labels.push('names=' + names.join(','));
  } else if (opts.all) {
    out = everything;
    labels.push('all');
  } else {
    if (!opts.suite && !opts.grep && !opts.list) throw new Error('select journeys: pass names, --all, --suite, --grep or --list');
    out = everything;
    labels.push('all');
  }
  if (opts.suite) {
    out = out.filter((j) => j.suite === opts.suite);
    labels.push('suite=' + opts.suite);
  }
  if (opts.grep) {
    let re: RegExp;
    try {
      re = new RegExp(opts.grep);
    } catch (err) {
      throw new Error(`--grep: ${(err as Error).message}`);
    }
    out = out.filter((j) => re.test(j.name) || re.test(j.desc));
    labels.push('grep=' + opts.grep);
  }
  if (out.length === 0 && !opts.list) throw new Error(`no journeys match ${labels.join(' ')}`);
  return { selected: out, label: labels.join(' ') };
}

/** Runs the selected journeys one by one (each in a fresh browser), emits the summary and throws when any failed. */
export async function runJourneys(command: string, selected: Journey[], label: string): Promise<void> {
  const start = Date.now();
  const base = currentBaseURL();
  const vp = viewport();
  const mode = gateMode();
  const opts = { baseURL: base, headless: g.headless, screenshotDir: g.screenshotDir, viewport: vp, colorScheme: g.colorScheme, mode, renderAt: renderViewports(vp) };
  const results: JourneyResult[] = [];
  let passed = 0;
  let failed = 0;
  for (const [i, j] of selected.entries()) {
    logf(`journey ${i + 1}/${selected.length} ${j.name} (${j.suite})`);
    const r = await runOne(j, opts);
    logf(`${r.ok ? 'PASS' : 'FAIL'} ${j.name} in ${r.durationMs}ms -> ${r.artifacts.runDir}`);
    if (!r.ok) logf(`  ${r.error}`);
    results.push(r);
    if (r.ok) passed++;
    else failed++;
  }
  const out = {
    command,
    ok: failed === 0,
    selection: label,
    gatesMode: mode,
    viewport: g.viewport,
    baseUrl: base,
    total: selected.length,
    passed,
    failed,
    durationMs: Date.now() - start,
    results,
  };
  logf(`${passed}/${out.total} journeys passed (gates ${mode})`);
  emit(out);
  if (!out.ok) throw new Error(`${failed} of ${out.total} journeys failed`);
}
