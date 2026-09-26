import { Testids, tid } from '../selectors.ts';
import { openFixture, waitForCount, waitForPath, waitVisible } from './helpers.ts';
import { expect, q, register, type Context } from './registry.ts';

// Loan dates in the demo fixture are relative to today; freeze it so stamps are exact.
// Dune: lent to Sam 5 Jun, due 26 Jun. Roger Ackroyd: lent to Priya, due 10 Jun (5 days overdue).
// Mort: lent to Sam, returned 14 Apr.
const TODAY = '2026-06-15';

const shelfRow = tid(Testids.home.row);

async function textOf(c: Context, selector: string): Promise<string> {
  return (await c.page.locator(selector).first().innerText()).trim();
}

async function openShelfBook(c: Context, title: string): Promise<string> {
  await waitForCount(c, shelfRow, 12, '/');
  await c.page.locator(`${shelfRow}[aria-label^="${title},"]`).click();
  const path = await waitForPath(c, /^\/book\/\d+$/, `/ -> ${title}`);
  await waitVisible(c, tid(Testids.bookDetail.title), path);
  return path;
}

register({
  name: 'loan-double-lend-blocked',
  suite: 'p05',
  desc: 'A book already on loan offers "Mark returned", not "Lend", so a second open loan cannot be started',
  async run(c) {
    await openFixture(c, 'demo', '/', TODAY);
    const path = await openShelfBook(c, 'Dune');
    await waitVisible(c, tid(Testids.bookLoan.stamp), path);
    expect((await c.page.locator(tid(Testids.lend.open)).count()) === 0, `${path}: expected no Lend button on a book that is out`);
    expect(await c.page.locator(tid(Testids.returnLoan.open)).isVisible(), `${path}: expected "Mark returned"`);
    const summary = await textOf(c, tid(Testids.bookLoan.summary));
    expect(summary === 'Lent to Sam on 5 Jun 2026. Due back on 26 Jun 2026.', `${path}: expected the loan summary, found ${q(summary)}`);
  },
});
