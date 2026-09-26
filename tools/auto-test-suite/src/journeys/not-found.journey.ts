import { ExpectedMissingMarker } from '../uxgates/expected.ts';
import { expect, q, register } from './registry.ts';

// expoRouterUnmatched is the testid Expo Router puts on its built-in not-found
// screen. It is framework-owned, so it is not in selectors.json; when the app
// adds its own +not-found screen, give it a generated testid and switch this
// journey to it.
const expoRouterUnmatched = '[data-testid="expo-router-unmatched"]';

register({
  name: 'not-found',
  suite: 'core',
  desc: 'An unknown route renders the not-found screen (h1 "Unmatched Route") instead of a blank page or home',
  async run(c) {
    // The built-in screen has no main landmark. Waive exactly those rules,
    // with the reason recorded in uxgates.json, rather than disabling them
    // globally.
    const why = "Expo Router's built-in not-found screen has no main landmark; replace with an app-owned +not-found screen";
    c.gates.waive('a11y', 'one-main', why);
    c.gates.waive('render', 'landmarks', why);

    const path = '/missing-shelf' + ExpectedMissingMarker;
    await c.gotoMarker(path, expoRouterUnmatched);
    const h1 = c.page.locator(`${expoRouterUnmatched} h1, ${expoRouterUnmatched} [role="heading"][aria-level="1"]`).first();
    let text: string;
    try {
      text = await h1.innerText();
    } catch (err) {
      throw new Error(`${path}: no h1 on the not-found screen: ${(err as Error).message}`);
    }
    expect(text === 'Unmatched Route', `${path}: expected h1 ${q('Unmatched Route')}, found ${q(text)}`);
    // The router must not have silently redirected somewhere else.
    const url = c.page.url();
    expect(url === c.url(path), `${path}: expected to stay on ${c.url(path)}, landed on ${url}`);
  },
});
