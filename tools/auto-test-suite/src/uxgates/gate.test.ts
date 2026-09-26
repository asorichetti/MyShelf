import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import { getConfig, loadAllowlist, loadConfig, parseAllowlist, parseConfig, skippedList } from './config.ts';
import { ExpectedMissingMarker, isExpectedMissing } from './expected.ts';
import { GateError, Recorder, SeverityWarn, newResult, parseMode, type Mode } from './gate.ts';

describe('parseMode', () => {
  test('accepts off, warn, fail (any case) and empty as warn', () => {
    const cases: Record<string, Mode> = { off: 'off', warn: 'warn', FAIL: 'fail', '': 'warn' };
    for (const [input, want] of Object.entries(cases)) assert.equal(parseMode(input), want, input);
  });
  test('rejects anything else', () => {
    assert.throws(() => parseMode('loud'), /invalid --ux-gates "loud"/);
  });
});

describe('Recorder', () => {
  const bad = () => newResult('console', '/x', Date.now(), [{ message: 'boom' }]);
  const good = () => newResult('console', '/x', Date.now(), []);

  test('pass is computed from error findings', () => {
    assert.equal(bad().pass, false);
    assert.equal(good().pass, true);
    assert.equal(bad().findings[0]!.severity, 'error', 'severity defaults to error');
  });

  test('add returns an error only in fail mode', () => {
    const warn = new Recorder('warn');
    assert.equal(warn.add(bad()), undefined);
    assert.equal(warn.failed(), true, 'warn recorder should still report failed()');
    const fail = new Recorder('fail');
    assert.equal(fail.add(good()), undefined);
    const err = fail.add(bad());
    assert.ok(err instanceof GateError);
    assert.equal(err.message, 'console gate failed on /x: boom');
  });

  test('off mode is disabled', () => {
    assert.equal(new Recorder('off').enabled(), false);
    assert.equal(new Recorder('warn').enabled(), true);
  });

  test('a warn-only result passes', () => {
    assert.equal(newResult('a11y', '/x', Date.now(), [{ severity: SeverityWarn, message: 'advisory' }]).pass, true);
  });

  test('a waiver downgrades the finding but keeps it', () => {
    const rec = new Recorder('fail');
    rec.waive('a11y', 'one-main', 'framework screen');
    assert.equal(rec.add(newResult('a11y', '/x', Date.now(), [{ rule: 'one-main', message: 'no main' }])), undefined);
    const got = rec.all()[0]!;
    assert.equal(got.findings.length, 1);
    assert.equal(got.findings[0]!.severity, 'warn');
    assert.equal(got.findings[0]!.message, '[waived: framework screen] no main');
    assert.equal(got.pass, true);
    assert.ok(rec.add(newResult('a11y', '/x', Date.now(), [{ rule: 'one-h1', message: 'two h1' }])), 'a different rule must not be waived');
  });

  test('a waiver needs a reason', () => {
    assert.throws(() => new Recorder('fail').waive('a11y', 'one-main', '  '), /needs a reason/);
  });

  test('summary and failures', () => {
    const rec = new Recorder('warn');
    rec.add(newResult('render', '/x @mobile', Date.now(), [{ rule: 'overflow', message: 'too wide' }]));
    rec.add(newResult('a11y', '/x', Date.now(), [{ rule: 'one-h1', severity: SeverityWarn, message: 'meh' }]));
    assert.deepEqual(rec.summary(), { mode: 'warn', failed: true, results: 2, findings: 2, findingsByGate: { render: 1, a11y: 1 } });
    assert.deepEqual(rec.failures(), ['render/overflow [/x @mobile]: too wide']);
  });
});

describe('gates config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autotest-config-'));
  after(() => {
    loadConfig('');
    loadAllowlist('');
  });

  test('the shipped config and allowlist are valid', () => {
    loadConfig('');
    loadAllowlist('');
    assert.ok(getConfig().render.landmarks.includes('main'));
  });

  const rejects: Record<string, [unknown, RegExp]> = {
    'no-reason': [{ render: { disabled: { overflow: '' } }, a11y: {} }, /render\.disabled\.overflow: a reason is required/],
    unknown: [{ render: {}, a11y: { disabled: { nope: 'why' } } }, /a11y\.disabled: unknown rule "nope"/],
    token: [{ render: { requiredTokens: ['ms-bg'] }, a11y: {} }, /must be a CSS custom property/],
    'unknown field': [{ render: { landmark: ['main'] }, a11y: {} }, /unknown field "render\.landmark"/],
    'unknown section': [{ render: {}, a11y: {}, console: {} }, /unknown field "console"/],
    'wrong type': [{ render: { requiredTokens: '--ms-x' }, a11y: {} }, /array of strings/],
  };
  for (const [name, [body, want]] of Object.entries(rejects)) {
    test(`rejects ${name}`, () => {
      const p = join(dir, `${name}.json`);
      writeFileSync(p, JSON.stringify(body));
      assert.throws(() => loadConfig(p), want);
    });
  }

  test('a rejected file leaves the active config unchanged', () => {
    loadConfig('');
    const before = getConfig();
    assert.throws(() => parseConfig({ render: { disabled: { overflow: '' } } }, 'x'));
    assert.equal(getConfig(), before);
  });

  test('invalid JSON names the file', () => {
    const p = join(dir, 'broken.json');
    writeFileSync(p, '{');
    assert.throws(() => loadConfig(p), /parse gates config .*broken\.json/);
  });

  test('skipped lists disabled rules with reasons, sorted', () => {
    assert.deepEqual(skippedList({ b: 'two', a: 'one' }), ['a: one', 'b: two']);
  });
});

describe('console allowlist', () => {
  after(() => loadAllowlist(''));

  test('an entry without a reason is rejected', () => {
    const p = join(mkdtempSync(join(tmpdir(), 'autotest-allow-')), 'a.json');
    writeFileSync(p, JSON.stringify([{ pattern: 'x' }]));
    assert.throws(() => loadAllowlist(p), /both pattern and reason are required/);
  });

  test('an invalid pattern is rejected', () => {
    assert.throws(() => parseAllowlist([{ pattern: '(', reason: 'r' }], 'x'), /entry 0/);
  });

  test('a valid entry compiles', () => {
    const [rule] = parseAllowlist([{ pattern: 'ResizeObserver loop', reason: 'benign browser warning' }], 'x');
    assert.ok(rule!.re.test('ResizeObserver loop limit exceeded'));
  });
});

describe('expected-missing marker', () => {
  test('detects the marker in URLs and messages only', () => {
    assert.equal(ExpectedMissingMarker, '__expected-404');
    assert.equal(isExpectedMissing('http://localhost:8081/nope__expected-404'), true);
    assert.equal(isExpectedMissing('http://localhost:8081/nope'), false);
    assert.equal(isExpectedMissing(undefined), false);
  });
});
