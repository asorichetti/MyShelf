import { Testids, tid } from '../selectors.ts';
import { expect, q, register } from './registry.ts';

const emptyState = tid(Testids.emptyState.root);
const avatar = tid(Testids.booky.avatar);
const askBooky = tid(Testids.home.askBooky);
const bubble = tid(Testids.booky.bubble);
const bubbleText = tid(Testids.booky.bubbleText);
const dismiss = tid(Testids.booky.dismiss);

register({
  name: 'booky-empty-shelf',
  suite: 'core',
  desc: 'Booky shows in the empty Shelf; "What can Booky do?" opens a tip bubble that passes the page gates and the dismiss button closes',
  async run(c) {
    await c.goto('/');

    const booky = c.page.locator(emptyState).locator(avatar);
    expect((await booky.count()) === 1, `/: expected one ${avatar} inside ${emptyState}, found ${await booky.count()}`);
    expect(await booky.isVisible(), `/: ${avatar} is in the empty shelf but not visible`);
    const role = await booky.getAttribute('role');
    const label = (await booky.getAttribute('aria-label')) ?? '';
    expect(role === 'img' && label.startsWith('Booky'), `/: expected Booky as role=img with a "Booky..." label, found role=${q(role)} label=${q(label)}`);
    expect((await c.page.locator(bubble).count()) === 0, `/: expected no tip bubble ${bubble} before asking Booky`);

    await c.page.locator(askBooky).click();
    try {
      await c.page.locator(bubble).waitFor({ state: 'visible' });
    } catch (err) {
      expect(false, `/: tapping ${askBooky} did not open ${bubble}: ${(err as Error).message}`);
    }
    const text = (await c.page.locator(bubbleText).innerText()).trim();
    expect(text.length > 0, `/: expected text in ${bubbleText}, found ${q(text)}`);
    // The open bubble adds a dismiss button, a second Booky and a live region:
    // the page must still pass every page gate (target-size included).
    await c.checkGates('/ (Booky tip open)');
    await c.snap('booky-tip-open');

    await c.page.locator(dismiss).click();
    try {
      await c.page.locator(bubble).waitFor({ state: 'detached' });
    } catch (err) {
      expect(false, `/: tapping ${dismiss} did not close ${bubble}: ${(err as Error).message}`);
    }
    expect(await booky.isVisible(), `/: the empty-shelf Booky ${avatar} disappeared after dismissing the tip`);
  },
});
