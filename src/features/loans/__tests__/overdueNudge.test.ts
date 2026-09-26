import { initialEngineState, markShown, selectFirst, type EngineState } from '@/components/booky/engine';
import { loansRepo, settingsRepo, type Db } from '@/db';
import { setToday, type LoanWithDetails } from '@/domain';
import { overdueNudgeEvents, overdueNudgeMessage } from '@/features/loans/overdueNudge';
import { overdueEvents } from '@/features/loans/useOverdueNudge';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

const loan = (id: number, bookTitle: string, borrowerName: string, dueOn: string): LoanWithDetails => ({
  id,
  bookId: id,
  borrowerId: id,
  bookTitle,
  borrowerName,
  lentOn: '2026-05-01',
  dueOn,
  returnedOn: null,
  note: null,
});

const TODAY = '2026-06-15';
const dune = loan(1, 'Dune', 'Sam', '2026-06-12');
const emma = loan(2, 'Emma', 'Priya', '2026-06-14');
const state = (patch: Partial<EngineState> = {}) => initialEngineState(TODAY, patch);
const pick = (s: EngineState, overdue = [emma, dune], today = TODAY) => selectFirst({ ...s, today }, overdueNudgeEvents(overdue, today), 0);
/** The next app start: nothing on screen, no cooldown running. */
const restart = (s: EngineState) => ({ ...s, current: null, lastNudge: null, session: [] });

describe('overdueNudgeEvents', () => {
  it('lists the most overdue loan first, in Booky’s words', () => {
    const events = overdueNudgeEvents([emma, dune], TODAY);
    expect(events.map((e) => e.key)).toEqual([1, 2]);
    expect(pick(state())).toMatchObject({ key: 'loan-overdue:1', text: '“Dune” was due back from Sam 3 days ago.', title: 'A gentle nudge', action: { label: 'Open loans', href: '/loans' } });
  });

  it('says "yesterday" for one day', () => {
    expect(overdueNudgeMessage(emma, TODAY)).toBe('“Emma” was due back from Priya yesterday.');
    expect(selectFirst(state(), overdueNudgeEvents([emma], TODAY), 0)?.text).toBe(overdueNudgeMessage(emma, TODAY));
  });

  it('skips returned loans and loans not yet due', () => {
    expect(overdueNudgeEvents([{ ...dune, returnedOn: '2026-06-14' }, loan(3, 'Mort', 'Kim', TODAY)], TODAY)).toEqual([]);
  });
});

describe('the engine and the overdue nudge (P05-10 rules)', () => {
  it('nudges at most once per loan per day', () => {
    let s = markShown(state(), pick(state())!, 0);
    const second = pick(restart(s))!;
    expect(second.key).toBe('loan-overdue:2');
    s = markShown(restart(s), second, 0);
    expect(pick(restart(s))).toBeNull();
    // A new day, a new nudge.
    expect(pick(restart(s), [emma, dune], '2026-06-16')?.key).toBe('loan-overdue:1');
  });

  it.each(['quiet', 'off'] as const)('stays silent in Booky mode "%s"', (mode) => {
    expect(pick(state({ mode }))).toBeNull();
  });

  it('stays silent when overdue tips are muted, or nothing is overdue', () => {
    expect(pick(state({ muted: ['loan-overdue'] }))).toBeNull();
    expect(pick(state(), [])).toBeNull();
  });
});

describe('overdueEvents (demo fixture)', () => {
  let db: Db;
  beforeEach(async () => {
    setToday(TODAY);
    db = await createTestDb();
    await loadFixture(db, 'demo');
  });
  afterEach(async () => {
    setToday(null);
    await db.close();
  });

  it('nudges about Roger Ackroyd', async () => {
    const events = await overdueEvents(db, TODAY);
    expect(selectFirst(state(), events, 0)?.text).toBe('“The Murder of Roger Ackroyd” was due back from Priya 5 days ago.');
    const tomorrow = await overdueEvents(db, '2026-06-16');
    expect(selectFirst(state({ today: '2026-06-16' }), tomorrow, 0)?.text).toBe('“The Murder of Roger Ackroyd” was due back from Priya 6 days ago.');
  });

  it('says nothing once the book is back', async () => {
    const [late] = await loansRepo.listOverdueLoans(db, TODAY);
    await loansRepo.returnLoan(db, late.id, TODAY);
    expect(await overdueEvents(db, TODAY)).toEqual([]);
  });
});

describe('loading a fixture', () => {
  it('forgets what Booky has said, since loan and series ids start again', async () => {
    const db = await createTestDb();
    await settingsRepo.setSetting(db, 'booky.seen', ['loan-overdue:2@2026-06-15', 'series-gap:3']);
    await loadFixture(db, 'demo');
    expect(await settingsRepo.getSetting(db, 'booky.seen')).toEqual([]);
    await db.close();
  });
});
