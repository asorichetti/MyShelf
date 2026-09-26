import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Viewports, defaultHeadless, resolveViewport, viewportName } from '../browser/browser.ts';
import { joinErrors } from '../errors.ts';
import { baseURL, parseBoolFlag, parseIntFlag, renderViewports, resolveURL, splitList } from './root.ts';

describe('baseURL', () => {
  test('--env local', () => assert.equal(baseURL('local', ''), 'http://localhost:8081'));
  test('--base-url overrides --env and loses its trailing slash', () => {
    assert.equal(baseURL('local', 'http://localhost:9000/'), 'http://localhost:9000');
    assert.equal(baseURL('nowhere', 'http://localhost:9000'), 'http://localhost:9000');
  });
  test('an unknown env fails', () => assert.throws(() => baseURL('nowhere', ''), /unknown --env "nowhere"/));
  test('an invalid URL fails', () => assert.throws(() => baseURL('local', 'localhost:8081'), /invalid base URL/));
});

test('resolveURL joins paths and passes absolute URLs through', () => {
  const cases: Record<string, string> = { '/': 'http://h/', shelf: 'http://h/shelf', 'https://x/y': 'https://x/y' };
  for (const [input, want] of Object.entries(cases)) assert.equal(resolveURL('http://h', input), want, input);
});

describe('renderViewports', () => {
  test('mobile renders at mobile and desktop', () => {
    const got = renderViewports(Viewports.mobile!);
    assert.deepEqual(got.map((s) => s.width), [390, 1280]);
  });
  test('desktop renders at desktop and mobile', () => {
    assert.deepEqual(renderViewports(Viewports.desktop!).map((s) => s.width), [1280, 390]);
  });
  test('tablet renders at all three widths, keeping its height', () => {
    const got = renderViewports(Viewports.tablet!);
    assert.deepEqual(got.map((s) => s.width), [820, 390, 1280]);
    assert.ok(got.every((s) => s.height === 1180));
  });
});

describe('viewports', () => {
  test('presets resolve, case-insensitively', () => assert.deepEqual(resolveViewport(' Mobile ', {}), { width: 390, height: 844 }));
  test('unknown presets fail', () => assert.throws(() => resolveViewport('huge', {}), /unknown viewport "huge"/));
  test('AUTOTEST_VIEWPORT_HEIGHT overrides the height', () => {
    assert.deepEqual(resolveViewport('desktop', { AUTOTEST_VIEWPORT_HEIGHT: '3000' }), { width: 1280, height: 3000 });
    assert.throws(() => resolveViewport('desktop', { AUTOTEST_VIEWPORT_HEIGHT: 'tall' }), /not a positive integer/);
    assert.throws(() => resolveViewport('desktop', { AUTOTEST_VIEWPORT_HEIGHT: '0' }), /not a positive integer/);
  });
  test('viewportName matches on width', () => {
    assert.equal(viewportName({ width: 390, height: 3000 }), 'mobile');
    assert.equal(viewportName({ width: 500, height: 600 }), '500x600');
  });
});

test('defaultHeadless follows display presence, not CI alone', () => {
  assert.equal(defaultHeadless({ CI: '1', DISPLAY: ':0' }, 'linux'), true);
  assert.equal(defaultHeadless({ DISPLAY: ':0' }, 'linux'), false);
  assert.equal(defaultHeadless({ WAYLAND_DISPLAY: 'wayland-0' }, 'linux'), false);
  assert.equal(defaultHeadless({}, 'linux'), true);
  assert.equal(defaultHeadless({}, 'darwin'), false);
});

describe('flag parsing', () => {
  test('--headless values', () => {
    assert.equal(parseBoolFlag(true), true);
    assert.equal(parseBoolFlag('false'), false);
    assert.equal(parseBoolFlag('TRUE'), true);
    assert.throws(() => parseBoolFlag('maybe'), /want true or false/);
  });
  test('integers', () => {
    assert.equal(parseIntFlag('--wait')('2000'), 2000);
    assert.throws(() => parseIntFlag('--wait')('2s'), /invalid argument "2s" for "--wait"/);
  });
  test('lists', () => assert.deepEqual(splitList(' mobile, ,desktop,'), ['mobile', 'desktop']));
});

test('joinErrors', () => {
  assert.equal(joinErrors([undefined, null]), undefined);
  const one = new Error('one');
  assert.equal(joinErrors([undefined, one]), one);
  assert.equal(joinErrors([one, new Error('two')])!.message, 'one\ntwo');
});
