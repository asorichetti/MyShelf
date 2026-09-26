// Self-tests for the tip check (tipCover.ts): on hand-made pages with a
// floating "tip", a control stuck under it is reported, one that scrolling
// really brings clear is not (and counts as revealed), one the page cannot
// scroll far enough is reported, and a control hidden behind something else
// is none of the tip's business. Run with `npm run autotest:selftest`
// (needs Chromium); skipped without it, except under CI.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import { chromium, type Browser as PWBrowser, type Page } from 'playwright';

import { tipCover } from './tipCover.ts';
import { EVALUATE_SHIM } from '../browser/browser.ts';

const haveChromium = existsSync(chromium.executablePath());
const skip = haveChromium ? false : 'Chromium is not installed (npm run autotest:install-browser)';
if (skip && process.env.CI) throw new Error(`tip check self-tests: ${skip}; CI must install it before running them`);
if (skip) process.stderr.write(`tip check self-tests skipped: ${skip}\n`);

const HOST = '#tip';

/** A 400 x 800 page: a scroller filling it, `content` inside, and a 200 px tip fixed at the bottom. */
const page = (content: string, { padding = 0, extra = '' } = {}) => `<!doctype html>
<style>
  body { margin: 0; }
  #scroller { position: absolute; inset: 0; overflow-y: auto; padding-bottom: ${padding}px; box-sizing: border-box; }
  button { display: block; width: 200px; height: 48px; margin: 0 0 8px; }
  .spacer { height: 500px; }
  #tip { position: fixed; left: 10px; right: 10px; bottom: 10px; height: 200px; background: #eee; }
</style>
<div id="scroller">${content}</div>
${extra}
<div id="tip"><button>Inside the tip</button></div>`;

describe('tip check', { skip }, () => {
  let browser: PWBrowser;
  let p: Page;

  before(async () => {
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 400, height: 800 } });
    await ctx.addInitScript({ content: EVALUATE_SHIM });
    p = await ctx.newPage();
  });
  after(async () => browser?.close());

  const check = async (content: string, options?: Parameters<typeof page>[1]) => {
    await p.setContent(page(content, options));
    return tipCover(p, [HOST]);
  };

  test('no tip: nothing to check', async () => {
    const r = await check('<button>Alone</button>').then(() => tipCover(p, ['#no-such-tip']));
    assert.equal(r.tip, null);
    assert.deepEqual(r.stuck, []);
  });

  test('a control under the tip on a page that does not scroll is stuck', async () => {
    await p.setContent(`<style>body{margin:0}#tip{position:fixed;left:0;right:0;bottom:0;height:200px;background:#eee}button{position:absolute;top:700px;width:200px;height:48px}</style>
      <button>Mark returned</button><div id="tip"></div>`);
    const r = await tipCover(p, [HOST]);
    assert.equal(r.stuck.length, 1, JSON.stringify(r));
    assert.match(r.stuck[0]!, /^Mark returned/);
  });

  test('a control under the tip that scrolling brings clear is revealed, not stuck', async () => {
    // At 620 px, under the tip (590 to 790); the scroller can move it up by its 220 px of room.
    const r = await check(`<div style="height: 620px"></div><button>Mark returned</button>`, { padding: 220 });
    assert.deepEqual(r.stuck, [], JSON.stringify(r));
    assert.deepEqual(r.revealed, ['Mark returned']);
    assert.ok(r.checked.includes('Mark returned'));
    // The page's own scroll position is put back.
    assert.equal(await p.evaluate(() => document.getElementById('scroller')!.scrollTop), 0);
  });

  test('a control at the end of a scroller with no room below it for the tip is stuck', async () => {
    const r = await check(`<div class="spacer"></div><div class="spacer"></div><button>Mark returned</button>`);
    assert.equal(r.stuck.length, 1, JSON.stringify(r));
    assert.match(r.stuck[0]!, /^Mark returned/);
  });

  test('a control further down reaches the clear area when the scroller has room for the tip', async () => {
    const r = await check(`<div class="spacer"></div><div class="spacer"></div><button>Lend</button>`, { padding: 220 });
    assert.deepEqual(r.stuck, [], JSON.stringify(r));
    assert.ok(r.checked.includes('Lend'));
  });

  test('controls covered by something else, or inside the tip, are not the tip’s business', async () => {
    const r = await check(`<div class="spacer"></div><button>Under a sheet</button>`, {
      extra: '<div style="position:fixed;inset:0;background:#fff"></div>',
    });
    assert.deepEqual(r.stuck, [], JSON.stringify(r));
    assert.ok(!r.checked.includes('Inside the tip'));
  });

  test('every kind of control counts: links, inputs and ARIA roles', async () => {
    await p.setContent(`<style>body{margin:0}#tip{position:fixed;left:0;right:0;bottom:0;height:300px;background:#eee}.c{position:absolute;left:10px;width:150px;height:40px}</style>
      <a class="c" style="top:520px" href="#">Link</a>
      <input class="c" style="top:570px" aria-label="Search">
      <div class="c" style="top:620px" role="switch" aria-label="Switch"></div>
      <div class="c" style="top:670px" role="tab" aria-label="Tab"></div>
      <div class="c" style="top:720px" role="checkbox" aria-label="Box"></div>
      <div id="tip"></div>`);
    const r = await tipCover(p, [HOST]);
    assert.deepEqual(r.stuck.map((s) => s.split(' (')[0]).sort(), ['Box', 'Link', 'Search', 'Switch', 'Tab']);
  });
});
