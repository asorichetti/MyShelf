// Gate self-tests: proof that every gate rule fires. Each fixture in
// fixtures.ts is served by the --serve static server, loaded in Chromium and
// put through the same checkPage/checkTraffic calls a journey uses; the test
// asserts that exactly the expected gate/rule findings come out. A rule whose
// check is removed or broken stops firing and fails its fixture; a coverage
// test fails when a rule id has no fixture at all.
//
// Run with `npm run autotest:selftest` (needs Chromium: `npm run
// autotest:install-browser`). Without Chromium the tests are skipped with a
// message, except under CI, where a missing browser is a failure.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { FontPath, MockFiles, MockIndexRoutes, fixtures, selfTestConfig } from './fixtures.ts';
import { Browser, Viewports } from '../../browser/browser.ts';
import { Listeners } from '../../browser/listeners.ts';
import { loadMockIndex, type MockIndex } from '../../mockapi/index.ts';
import { setMockApi } from '../../mockapi/route.ts';
import { startStaticServer, type StaticServer } from '../../server/static.ts';
import { checkPage, checkTraffic } from '../check.ts';
import { A11yRules, RenderRules, loadAllowlist, loadConfig } from '../config.ts';
import { Recorder, SeverityError, type Result } from '../gate.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fontSource = join(repoRoot, 'node_modules/@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf');

const haveChromium = existsSync(chromium.executablePath());
const skip = haveChromium ? false : 'Chromium is not installed (npm run autotest:install-browser)';
if (skip && process.env.CI) {
  throw new Error(`gate self-tests: ${skip}; CI must install it before running them`);
}
if (skip) process.stderr.write(`gate self-tests skipped: ${skip}\n`);

/** Every rule a fixture must prove, as gate/rule. */
const allRules = [
  'pagestate/content-marker',
  'pagestate/error-marker',
  'pagestate/main-text',
  ...RenderRules.map((r) => `render/${r}`),
  ...A11yRules.map((r) => `a11y/${r}`),
  'console/error',
  'console/pageerror',
  'network/http-status',
  'network/request-failed',
  'network/unmocked',
];

test('every gate rule has a fixture that fires it', () => {
  const covered = new Set(fixtures.flatMap((f) => f.fires));
  const missing = allRules.filter((r) => !covered.has(r));
  assert.deepEqual(missing, [], `rules without a fixture: ${missing.join(', ')}`);
  const names = fixtures.map((f) => f.name);
  assert.equal(new Set(names).size, names.length, 'fixture names must be unique');
});

describe('gate self-tests', { skip }, () => {
  let dir: string;
  let srv: StaticServer;
  let browser: Browser;
  let mockIndex: MockIndex;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'autotest-gate-fixtures-'));
    for (const f of fixtures) writeFileSync(join(dir, `${f.name}.html`), f.html);
    mkdirSync(dirname(join(dir, FontPath)), { recursive: true });
    copyFileSync(fontSource, join(dir, FontPath));
    const cfg = join(dir, 'gates.config.json');
    writeFileSync(cfg, JSON.stringify(selfTestConfig));
    loadConfig(cfg);
    loadAllowlist('');
    const mockDir = join(dir, 'mock');
    mkdirSync(mockDir);
    writeFileSync(join(mockDir, 'index.json'), JSON.stringify({ routes: MockIndexRoutes }));
    for (const [name, body] of Object.entries(MockFiles)) writeFileSync(join(mockDir, name), body);
    mockIndex = loadMockIndex(mockDir);
    srv = await startStaticServer(dir, { fallback: 'clean.html' });
    browser = await Browser.launch(true);
  });

  after(async () => {
    setMockApi(null);
    await browser?.close();
    await srv?.close();
    loadConfig('');
  });

  // Loads one fixture and runs every gate over it, as a journey's goto would.
  async function gatesFor(name: string, mock = false): Promise<Result[]> {
    setMockApi(mock ? mockIndex : null, srv.url);
    const page = await browser.newPage(Viewports.mobile!, '');
    setMockApi(null);
    const listeners = Listeners.attach(page);
    const rec = new Recorder('warn');
    await page.goto(`${srv.url}/${name}.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => (window as unknown as { __pending?: number }).__pending === 0, undefined, { timeout: 5000 });
    await checkPage(page, rec, name, { timeoutMs: 2000 }, [Viewports.mobile!, Viewports.desktop!]);
    checkTraffic(listeners, rec, name);
    await page.context().close();
    return rec.all();
  }

  for (const f of fixtures) {
    test(`${f.name}: ${f.fires.length ? f.fires.join(' + ') : 'no findings'} (${f.why})`, async () => {
      const results = await gatesFor(f.name, f.mock);
      const errors = results.flatMap((r) => r.findings.filter((x) => x.severity === SeverityError));
      const fired = [...new Set(errors.map((x) => `${x.gate}/${x.rule ?? ''}`))].sort();
      const detail = errors.map((x) => `\n  ${x.gate}/${x.rule}: ${x.message}`).join('');
      assert.deepEqual(fired, [...f.fires].sort(), `${f.name}.html: expected ${JSON.stringify(f.fires)}, got ${JSON.stringify(fired)}${detail}`);
      // Every gate that should have run did: a skipped gate cannot prove anything.
      const gates = new Set(results.map((r) => r.gate));
      const want = f.fires.some((x) => x.startsWith('pagestate/'))
        ? ['console', 'network', 'pagestate']
        : ['a11y', 'console', 'network', 'pagestate', 'render'];
      assert.deepEqual([...gates].sort(), want, `${f.name}.html: gates that ran`);
    });
  }
});
