import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';

import { loansRepo, settingsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { addDays, today } from '@/domain';
import { emit, subscribe } from '@/features/events';
import { useReminderSetting, useReminderSync } from '@/features/loans/useReminderSync';
import { reminderScheduler, type ReminderScheduler } from '@/services/reminders';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { __reset, __tap, state } from '@/testing/mocks/expoNotifications';
import { AppTestProviders } from '@/testing/render';

import type { ReactNode } from 'react';

let db: Db;
beforeEach(async () => {
  __reset();
  // Real "today": reminders are planned against the real clock.
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(async () => {
  await db.close();
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppTestProviders>
    <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>
  </AppTestProviders>
);

/** The settings switch and the root sync together, as in the app. */
function renderBoth(scheduler: ReminderScheduler = reminderScheduler) {
  return renderHook(
    () => {
      useReminderSync(scheduler);
      return useReminderSetting(scheduler);
    },
    { wrapper },
  );
}
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {});
};
const duneId = async () => (await loansRepo.listOpenLoans(db)).find((l) => l.bookTitle === 'Dune')!;
const scheduledIds = () => [...state.scheduled.keys()];

describe('reminders (P05-08)', () => {
  it('are off by default and ask for nothing at start-up', async () => {
    const { result } = renderBoth();
    await settle();
    expect(result.current.enabled).toBe(false);
    expect(state.requests).toBe(0);
    expect(scheduledIds()).toEqual([]);
  });

  it('turning on asks permission, then schedules each open loan with a due date still ahead', async () => {
    const events: string[] = [];
    const off = subscribe('settings-changed', (e) => events.push(e));
    const { result } = renderBoth();
    await settle();
    await act(async () => result.current.setEnabled(true));
    await settle();
    expect(state.requests).toBe(1);
    expect(result.current).toMatchObject({ enabled: true, denied: false });
    expect(await settingsRepo.getSetting(db, 'loanReminders')).toBe(true);
    expect(events).toEqual(['settings-changed']);
    // Dune is due in 11 days; Roger Ackroyd is already overdue (Booky nudges instead).
    const dune = await duneId();
    expect(scheduledIds()).toEqual([`loan-due:${dune.id}:${addDays(today(), 11)}`]);
    off();
  });

  it('reschedules after a return and after a due-date change', async () => {
    await settingsRepo.setSetting(db, 'loanReminders', true);
    state.permission = { granted: true, status: 'granted', canAskAgain: true };
    renderBoth();
    await settle();
    const dune = await duneId();
    expect(scheduledIds()).toEqual([`loan-due:${dune.id}:${dune.dueOn}`]);

    const later = addDays(dune.dueOn!, 7);
    await loansRepo.updateLoan(db, dune.id, { dueOn: later });
    await act(async () => emit('loans-changed'));
    await settle();
    expect(scheduledIds()).toEqual([`loan-due:${dune.id}:${later}`]);

    await loansRepo.returnLoan(db, dune.id, today());
    await act(async () => emit('loans-changed'));
    await settle();
    expect(scheduledIds()).toEqual([]);
  });

  it('keeps the switch off and explains when permission is refused', async () => {
    state.answer = 'denied';
    const { result } = renderBoth();
    await settle();
    await act(async () => result.current.setEnabled(true));
    await settle();
    expect(result.current).toMatchObject({ enabled: false, denied: true });
    expect(await settingsRepo.getSetting(db, 'loanReminders')).toBe(false);
    expect(scheduledIds()).toEqual([]);
  });

  it('turning off cancels every reminder', async () => {
    await settingsRepo.setSetting(db, 'loanReminders', true);
    state.permission = { granted: true, status: 'granted', canAskAgain: true };
    const { result } = renderBoth();
    await settle();
    expect(scheduledIds()).toHaveLength(1);
    await act(async () => result.current.setEnabled(false));
    await settle();
    expect(result.current.enabled).toBe(false);
    expect(scheduledIds()).toEqual([]);
  });

  it('clears reminders when permission was withdrawn in the phone settings', async () => {
    await settingsRepo.setSetting(db, 'loanReminders', true);
    state.permission = { granted: true, status: 'granted', canAskAgain: true };
    renderBoth();
    await settle();
    expect(scheduledIds()).toHaveLength(1);
    state.permission = { granted: false, status: 'denied', canAskAgain: false };
    await act(async () => emit('loans-changed'));
    await settle();
    expect(scheduledIds()).toEqual([]);
  });

  it('opens the book when a reminder is tapped', async () => {
    const navigate = jest.spyOn(router, 'navigate').mockImplementation(() => {});
    await settingsRepo.setSetting(db, 'loanReminders', true);
    state.permission = { granted: true, status: 'granted', canAskAgain: true };
    renderBoth();
    await settle();
    const dune = await duneId();
    act(() => __tap(scheduledIds()[0]));
    expect(navigate).toHaveBeenCalledWith(`/book/${dune.bookId}`);
    navigate.mockRestore();
  });

  it('is unavailable (and does nothing) on web', async () => {
    const web: ReminderScheduler = { ...reminderScheduler, supported: false };
    await settingsRepo.setSetting(db, 'loanReminders', true);
    const { result } = renderBoth(web);
    await settle();
    expect(result.current).toMatchObject({ enabled: false, supported: false });
    await act(async () => result.current.setEnabled(true));
    expect(state.requests).toBe(0);
    expect(scheduledIds()).toEqual([]);
  });
});
