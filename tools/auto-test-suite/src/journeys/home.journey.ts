import { Viewports } from '../browser/browser.ts';
import { Testids, tid } from '../selectors.ts';
import { containsAll, serifRe } from './helpers.ts';
import { expect, q, register } from './registry.ts';

const homeTitle = tid(Testids.home.title);
const homeRoot = tid(Testids.home.root);

register({
  name: 'home-loads',
  suite: 'core',
  desc: 'Home renders its h1 inside the single main landmark, styled (bold, not default serif)',
  async run(c) {
    await c.goto('/');
    const title = c.page.locator(homeTitle);
    try {
      await title.waitFor();
    } catch (err) {
      expect(false, `/: home title ${homeTitle} never appeared: ${(err as Error).message}`);
    }
    const text = await title.innerText();
    expect(text === 'MyShelf', `/: expected h1 ${q('MyShelf')}, found ${q(text)}`);
    const info = await c.page.evaluate((sel) => {
      const el = document.querySelector(sel)!;
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName,
        level: el.getAttribute('aria-level') || '',
        inMain: !!el.closest('main, [role="main"]'),
        fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily,
        docTitle: document.title,
      };
    }, homeTitle);
    expect(info.tag === 'H1', `/: expected home title to be an <h1>, found <${info.tag} aria-level=${q(info.level)}>`);
    expect(info.inMain, '/: expected home title inside the main landmark');
    // Computed style, never class names: react-native-web classes are generated.
    expect(info.fontWeight === '700', `/: expected home title font-weight 700, computed ${q(info.fontWeight)} (styles did not apply?)`);
    expect(!serifRe.test(info.fontFamily), `/: home title renders in the default serif: ${q(info.fontFamily)}`);
    expect(info.docTitle === 'MyShelf', `/: expected document title ${q('MyShelf')}, found ${q(info.docTitle)}`);
    // Home is a landing screen: the main landmark must be visible in the root.
    expect(await c.page.locator(homeRoot).isVisible(), `/: expected ${homeRoot} to be visible`);
  },
});

register({
  name: 'home-responsive',
  suite: 'responsive',
  desc: 'Home at mobile, tablet and desktop: viewport meta present, title fully on screen, no sideways scroll',
  async run(c) {
    await c.goto('/');
    const meta = await c.page.evaluate(
      () => document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content || '',
    );
    // Invisible in any desktop screenshot, fatal on a phone.
    expect(
      containsAll(meta, 'width=device-width', 'initial-scale=1'),
      `/: viewport meta is ${q(meta)}, want width=device-width, initial-scale=1`,
    );
    for (const name of ['mobile', 'tablet', 'desktop']) {
      const vp = Viewports[name]!;
      await c.page.setViewportSize({ width: vp.width, height: vp.height });
      await c.settle();
      const m = await c.page.evaluate((sel) => {
        const el = document.querySelector(sel)!;
        const r = el.getBoundingClientRect();
        const de = document.documentElement;
        return { visible: r.width > 0 && r.height > 0, left: r.left, right: r.right, clientWidth: de.clientWidth, scrollWidth: de.scrollWidth };
      }, homeTitle);
      expect(m.visible, `/ @${name}: home title has no box`);
      expect(
        m.left >= 0 && m.right <= m.clientWidth,
        `/ @${name}: home title spans ${m.left.toFixed(0)}..${m.right.toFixed(0)}px, outside the ${m.clientWidth}px viewport`,
      );
      expect(
        m.scrollWidth <= m.clientWidth + 1,
        `/ @${name}: page scrolls sideways (scrollWidth ${m.scrollWidth} > clientWidth ${m.clientWidth})`,
      );
      await c.snap(`home-${name}`);
    }
    await c.page.setViewportSize({ width: c.viewport.width, height: c.viewport.height });
  },
});
