import { Testids, tid } from '../selectors.ts';
import { ExpectedMissingMarker } from '../uxgates/expected.ts';
import { expect, q, register } from './registry.ts';

const root = tid(Testids.notFound.root);
const title = tid(Testids.notFound.title);

register({
  name: 'not-found',
  suite: 'core',
  desc: 'An unknown route renders the app\'s not-found screen (h1 "Page not found") instead of a blank page or home',
  async run(c) {
    // The marker keeps the deliberately missing route out of the console and
    // network gates without an allowlist rule that would hide real 404s.
    const path = '/missing-shelf' + ExpectedMissingMarker;
    await c.goto(path);
    try {
      await c.page.locator(root).waitFor();
    } catch (err) {
      expect(false, `${path}: not-found screen ${root} never appeared: ${(err as Error).message}`);
    }
    const info = await c.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return { tag: el.tagName, text: (el as HTMLElement).innerText, inMain: !!el.closest('main, [role="main"]') };
    }, title);
    expect(info !== null, `${path}: no title ${title} on the not-found screen`);
    expect(info.text === 'Page not found', `${path}: expected h1 ${q('Page not found')}, found ${q(info.text)}`);
    expect(info.tag === 'H1', `${path}: expected the not-found title to be an <h1>, found <${info.tag}>`);
    expect(info.inMain, `${path}: expected the not-found title inside the main landmark`);
    // The router must not have silently redirected somewhere else.
    const url = c.page.url();
    expect(url === c.url(path), `${path}: expected to stay on ${c.url(path)}, landed on ${url}`);
  },
});
