import { loansRepo, settingsRepo, type Db } from '@/db';
import { setToday, type LoanWithDetails } from '@/domain';
import { markNudgeShown, overdueNudgeId, overdueNudgeMessage, pickOverdueNudge, type OverdueNudgeInput } from '@/features/loans/overdueNudge';
import { takeOverdueNudge } from '@/features/loans/useOverdueNudge';
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
const input = (patch: Partial<OverdueNudgeInput> = {}): OverdueNudgeInput => ({
  overdue: [emma, dune],
  today: TODAY,
  bookyMode: 'helpful',
  mutedTips: [],
  shown: [],
  ...patch,
});

describe('pickOverdueNudge', () => {
  it('nudges about the most overdue loan first, in Booky’s words', () => {
    expect(pickOverdueNudge(input())).toEqual({ id: 'loan-overdue:1:2026-06-15', loan: dune, message: '“Dune” was due back from Sam 3 days ago.' });
  });

  it('says "yesterday" for one day', () => {
    expect(overdueNudgeMessage(emma, TODAY)).toBe('“Emma” was due back from Priya yesterday.');
  });

  it('at most once per loan per day', () => {
    const shown = [overdueNudgeId(1, TODAY)];
    expect(pickOverdueNudge(input({ shown }))?.loan).toBe(emma);
    expect(pickOverdueNudge(input({ shown: [...shown, overdueNudgeId(2, TODAY)] }))).toBeNull();
    // A new day, a new nudge.
    expect(pickOverdueNudge(input({ shown, today: '2026-06-16' }))?.id).toBe('loan-overdue:1:2026-06-16');
  });

  it.each(['quiet', 'off'] as const)('stays silent in Booky mode "%s"', (bookyMode) => {
    expect(pickOverdueNudge(input({ bookyMode }))).toBeNull();
  });

  it('stays silent when overdue tips are muted, or nothing is overdue', () => {
    expect(pickOverdueNudge(input({ mutedTips: ['loan-overdue'] }))).toBeNull();
    expect(pickOverdueNudge(input({ overdue: [] }))).toBeNull();
    expect(pickOverdueNudge(input({ overdue: [{ ...dune, returnedOn: '2026-06-14' }, loan(3, 'Mort', 'Kim', TODAY)] }))).toBeNull();
  });
});

describe('markNudgeShown', () => {
  it('keeps only today’s ids, so the list never grows', () => {
    expect(markNudgeShown(['loan-overdue:1:2026-06-14', 'loan-overdue:2:2026-06-15'], 'loan-overdue:1:2026-06-15', TODAY)).toEqual([
      'loan-overdue:2:2026-06-15',
      'loan-overdue:1:2026-06-15',
    ]);
  });
});

describe('takeOverdueNudge (demo fixture)', () => {
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

  it('nudges about Roger Ackroyd once today, remembering it across restarts', async () => {
    const first = await takeOverdueNudge(db, TODAY);
    expect(first?.message).toBe('“The Murder of Roger Ackroyd” was due back from Priya 5 days ago.');
    expect(await settingsRepo.getSetting(db, 'overdueNudgesShown')).toEqual([first!.id]);
    expect(await takeOverdueNudge(db, TODAY)).toBeNull();
    expect((await takeOverdueNudge(db, '2026-06-16'))?.message).toBe('“The Murder of Roger Ackroyd” was due back from Priya 6 days ago.');
  });

  it('respects Booky mode from settings', async () => {
    await settingsRepo.setSetting(db, 'bookyMode', 'quiet');
    expect(await takeOverdueNudge(db, TODAY)).toBeNull();
    expect(await settingsRepo.getSetting(db, 'overdueNudgesShown')).toEqual([]);
  });

  it('says nothing once the book is back', async () => {
    const [late] = await loansRepo.listOverdueLoans(db, TODAY);
    await loansRepo.returnLoan(db, late.id, TODAY);
    expect(await takeOverdueNudge(db, TODAY)).toBeNull();
  });
});

describe('loading a fixture', () => {
  it('forgets which loans were nudged, since loan ids start again', async () => {
    const db = await createTestDb();
    await settingsRepo.setSetting(db, 'overdueNudgesShown', ['loan-overdue:2:2026-06-15']);
    await loadFixture(db, 'demo');
    expect(await settingsRepo.getSetting(db, 'overdueNudgesShown')).toEqual([]);
    await db.close();
  });
});
