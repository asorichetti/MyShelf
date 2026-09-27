// Phase 07: the first-run onboarding (P07-03). Only the `first-run` fixture
// asks for it; every other fixture starts with it done.
import { Testids, tid } from '../selectors.ts';
import { waitForNote, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

const o = Testids.onboarding;

/** Loads the `first-run` fixture, which lands on the Shelf and is sent on to the onboarding. */
export async function openFirstRun(c: Context): Promise<void> {
  const path = '/e2e?fixture=first-run&next=%2F';
  await c.goto(path);
  await waitForPath(c, '/onboarding', path);
  await waitVisible(c, tid(o.card), '/onboarding');
}

async function pageText(c: Context): Promise<string> {
  return (await c.page.locator(tid(o.page)).innerText()).trim();
}

async function h1(c: Context): Promise<string> {
  return (await c.page.locator('h1, [role="heading"][aria-level="1"]').first().innerText()).trim();
}

register({
  name: 'onboarding-first-run',
  suite: 'p07',
  desc: 'Fixture "first-run": the onboarding opens; four cards via Next, each announcing "Page n of 4" with one h1 -> "Let’s fill your shelf" lands on Scan; a reload does not show it again',
  async run(c) {
    await openFirstRun(c);
    for (let n = 1; n <= 4; n++) {
      const where = `/onboarding card ${n}`;
      const page = await pageText(c);
      expect(page === `Page ${n} of 4`, `${where}: expected ${q(`Page ${n} of 4`)}, found ${q(page)}`);
      const live = await c.page.locator(tid(o.page)).getAttribute('aria-live');
      expect(live === 'polite', `${where}: expected the page count in a polite live region, found aria-live=${q(live)}`);
      const booky = c.page.locator(`${tid(o.card)} [role="img"][aria-label^="Booky"]`);
      expect((await booky.count()) === 1, `${where}: expected one Booky, found ${await booky.count()}`);
      await c.checkGates(where);
      await c.snap(`onboarding-${n}`);
      if (n < 4) {
        const title = await h1(c);
        await c.page.locator(tid(o.next)).click();
        await c.page.waitForFunction(([sel, want]) => document.querySelector(sel as string)?.textContent?.trim() === want, [tid(o.page), `Page ${n + 1} of 4`] as const);
        expect((await h1(c)) !== title, `${where}: expected a new card title after Next`);
      }
    }
    expect((await c.page.locator(tid(o.skip)).count()) === 0, '/onboarding card 4: expected no Skip on the last card');
    await c.page.locator(tid(o.start)).click();
    await waitForPath(c, '/scan', '/onboarding -> Let’s fill your shelf');
    await waitVisible(c, tid(Testids.scan.root), '/scan');

    // Shown once: starting the app again goes straight to the Shelf.
    await c.goto('/');
    const redirect = await waitForNote<boolean>(c, 'onboarding-check', 0, '/ (second start)');
    expect(!redirect, '/ (second start): the onboarding check sent the user back to the onboarding');
    await c.settle();
    const path = new URL(c.page.url()).pathname;
    expect(path === '/', `/ (second start): expected to stay on the Shelf, went to ${q(path)}`);
  },
});

register({
  name: 'onboarding-skip',
  suite: 'p07',
  desc: 'Fixture "first-run": Skip on the first card -> the Shelf, and the onboarding is done',
  async run(c) {
    await openFirstRun(c);
    await c.page.locator(tid(o.skip)).click();
    await waitForPath(c, '/', '/onboarding -> Skip');
    await waitVisible(c, tid(Testids.home.root), '/');
    await c.checkGates('/ (after skip)');
    await c.page.reload();
    await waitVisible(c, tid(Testids.home.root), '/ (reload)');
    const redirect = await waitForNote<boolean>(c, 'onboarding-check', 0, '/ (reload)');
    expect(!redirect, '/ (reload): the onboarding check sent the user back to the onboarding');
    await c.settle();
    const path = new URL(c.page.url()).pathname;
    expect(path === '/', `/ (reload): expected to stay on the Shelf, went to ${q(path)}`);
  },
});
