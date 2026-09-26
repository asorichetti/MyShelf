import type { LoanWithDetails } from '@/domain';
import {
  diffReminders,
  planReminders,
  REMINDER_CHANNEL,
  reminderId,
  reminderScheduler,
  reminderTime,
  syncReminders,
  type ReminderScheduler,
} from '@/services/reminders';
import { __reset, __tap, state } from '@/testing/mocks/expoNotifications';

const loan = (id: number, dueOn: string | null, returnedOn: string | null = null): LoanWithDetails => ({
  id,
  bookId: id * 10,
  borrowerId: 1,
  bookTitle: `Book ${id}`,
  borrowerName: 'Sam',
  lentOn: '2026-06-01',
  dueOn,
  returnedOn,
  note: null,
});

// 15 June 2026, 09:00 local time.
const NOW = new Date(2026, 5, 15, 9, 0);

beforeEach(() => __reset());

describe('planReminders: which loans get a reminder, and when', () => {
  it('one per open loan with a due date, at 10:00 local time on the due date', () => {
    const plan = planReminders([loan(1, '2026-06-20'), loan(2, null), loan(3, '2026-06-18', '2026-06-10')], NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: 'loan-due:1:2026-06-20', loanId: 1, bookId: 10, url: '/book/10' });
    expect(plan[0].at).toEqual(new Date(2026, 5, 20, 10, 0));
    expect(plan[0].title).toBe('“Book 1” is due back today');
    expect(plan[0].body).toBe('Sam has it. A gentle reminder, no rush.');
  });

  it('includes a loan due today while 10:00 is still ahead, never one already past', () => {
    expect(planReminders([loan(1, '2026-06-15')], NOW).map((r) => r.id)).toEqual(['loan-due:1:2026-06-15']);
    expect(planReminders([loan(1, '2026-06-15')], new Date(2026, 5, 15, 10, 0))).toEqual([]);
    expect(planReminders([loan(1, '2026-06-14')], NOW)).toEqual([]);
  });

  it('skips a loan whose due date is not a real date (a corrupt row) instead of failing them all', () => {
    expect(planReminders([loan(1, 'zzz'), loan(2, '2026-02-30'), loan(3, '2026-06-20')], NOW).map((r) => r.loanId)).toEqual([3]);
  });

  it('keeps 10:00 across a daylight-saving change', () => {
    expect(reminderTime('2026-03-29').getHours()).toBe(10);
    expect(reminderTime('2026-10-25').getHours()).toBe(10);
  });
});

describe('diffReminders: rescheduling by id', () => {
  const plan = planReminders([loan(1, '2026-06-20'), loan(2, '2026-06-25')], NOW);

  it('schedules only what is missing', () => {
    expect(diffReminders(['loan-due:1:2026-06-20'], plan)).toEqual({ cancel: [], schedule: [plan[1]] });
  });

  it('cancels reminders for returned loans and changed due dates', () => {
    const after = planReminders([loan(2, '2026-06-27')], NOW);
    expect(diffReminders(['loan-due:1:2026-06-20', 'loan-due:2:2026-06-25'], after)).toEqual({
      cancel: ['loan-due:1:2026-06-20', 'loan-due:2:2026-06-25'],
      schedule: after,
    });
  });

  it('leaves notifications that are not reminders alone', () => {
    expect(diffReminders(['something-else'], [])).toEqual({ cancel: [], schedule: [] });
  });
});

/** An in-memory scheduler for the sync rules. */
function fakeScheduler(permission: 'granted' | 'denied' = 'granted', ids: string[] = []): ReminderScheduler & { ids: Set<string> } {
  const set = new Set(ids);
  return {
    ids: set,
    supported: true,
    getPermission: async () => permission,
    requestPermission: async () => permission,
    scheduledIds: async () => [...set],
    schedule: async (r) => void set.add(r.id),
    cancel: async (id) => void set.delete(id),
    onOpen: () => () => {},
  };
}

describe('syncReminders', () => {
  it('makes the scheduled set equal the open loans with due dates', async () => {
    const s = fakeScheduler('granted', ['loan-due:9:2026-06-01', 'other']);
    const result = await syncReminders(s, { enabled: true, loans: [loan(1, '2026-06-20'), loan(2, null)], now: NOW });
    expect(result).toEqual({ status: 'synced', scheduled: ['loan-due:1:2026-06-20'], cancelled: ['loan-due:9:2026-06-01'] });
    expect([...s.ids].sort()).toEqual(['loan-due:1:2026-06-20', 'other']);
    // Idempotent.
    expect(await syncReminders(s, { enabled: true, loans: [loan(1, '2026-06-20')], now: NOW })).toEqual({ status: 'synced', scheduled: [], cancelled: [] });
  });

  it('reschedules after a return or a due-date change', async () => {
    const s = fakeScheduler('granted');
    await syncReminders(s, { enabled: true, loans: [loan(1, '2026-06-20'), loan(2, '2026-06-25')], now: NOW });
    await syncReminders(s, { enabled: true, loans: [loan(1, '2026-06-20', '2026-06-16'), loan(2, '2026-07-01')], now: NOW });
    expect([...s.ids]).toEqual(['loan-due:2:2026-07-01']);
  });

  it('cancels every reminder when turned off', async () => {
    const s = fakeScheduler('granted', ['loan-due:1:2026-06-20', 'loan-due:2:2026-06-25', 'other']);
    expect(await syncReminders(s, { enabled: false, loans: [loan(1, '2026-06-20')], now: NOW })).toEqual({
      status: 'disabled',
      cancelled: ['loan-due:1:2026-06-20', 'loan-due:2:2026-06-25'],
    });
    expect([...s.ids]).toEqual(['other']);
  });

  it('schedules nothing, and clears what is there, without permission', async () => {
    const s = fakeScheduler('denied', ['loan-due:1:2026-06-20']);
    expect(await syncReminders(s, { enabled: true, loans: [loan(2, '2026-06-25')], now: NOW })).toEqual({
      status: 'no-permission',
      cancelled: ['loan-due:1:2026-06-20'],
    });
    expect(s.ids.size).toBe(0);
  });

  it('does nothing where reminders are unsupported (web)', async () => {
    const s = { ...fakeScheduler(), supported: false };
    expect(await syncReminders(s, { enabled: true, loans: [loan(1, '2026-06-20')], now: NOW })).toEqual({ status: 'unsupported' });
  });
});

describe('reminderScheduler (expo-notifications)', () => {
  it('schedules a local date notification in the loan reminders channel, with the book to open', async () => {
    const [r] = planReminders([loan(1, '2026-06-20')], NOW);
    await reminderScheduler.schedule(r);
    const scheduled = state.scheduled.get(reminderId({ id: 1, dueOn: '2026-06-20' }))!;
    expect(scheduled.content).toEqual({ title: r.title, body: r.body, data: { url: '/book/10', loanId: 1 } });
    expect(scheduled.trigger).toEqual({ type: 'date', date: r.at, channelId: REMINDER_CHANNEL });
    expect(await reminderScheduler.scheduledIds()).toEqual([r.id]);
    await reminderScheduler.cancel(r.id);
    expect(await reminderScheduler.scheduledIds()).toEqual([]);
  });

  it('asks for permission and reports the answer', async () => {
    expect(await reminderScheduler.getPermission()).toBe('undetermined');
    state.answer = 'denied';
    expect(await reminderScheduler.requestPermission()).toBe('denied');
    expect(await reminderScheduler.getPermission()).toBe('denied');
    state.answer = 'granted';
    expect(await reminderScheduler.requestPermission()).toBe('granted');
  });

  it('opens the book when a reminder is tapped', async () => {
    const [r] = planReminders([loan(1, '2026-06-20')], NOW);
    await reminderScheduler.schedule(r);
    const open = jest.fn();
    const stop = reminderScheduler.onOpen(open);
    __tap(r.id);
    expect(open).toHaveBeenCalledWith('/book/10');
    stop();
    __tap(r.id);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
