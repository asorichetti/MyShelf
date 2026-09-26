import type { LoanWithDetails } from '@/domain';

import { diffReminders, planReminders, REMINDER_PREFIX } from './plan';

import type { ReminderScheduler } from './types';

export type SyncResult =
  | { status: 'synced'; scheduled: string[]; cancelled: string[] }
  | { status: 'disabled'; cancelled: string[] }
  | { status: 'no-permission'; cancelled: string[] }
  | { status: 'unsupported' };

/**
 * Makes the scheduled reminders match the open loans: with reminders off
 * (or no permission) every reminder of ours is cancelled; otherwise the
 * difference is applied, cancelling first. Other notifications are untouched.
 */
export async function syncReminders(
  scheduler: ReminderScheduler,
  { enabled, loans, now }: { enabled: boolean; loans: readonly LoanWithDetails[]; now: Date },
): Promise<SyncResult> {
  if (!scheduler.supported) return { status: 'unsupported' };
  const scheduledIds = await scheduler.scheduledIds();
  const cancelAll = async () => {
    const ours = scheduledIds.filter((id) => id.startsWith(REMINDER_PREFIX));
    for (const id of ours) await scheduler.cancel(id);
    return ours;
  };
  if (!enabled) return { status: 'disabled', cancelled: await cancelAll() };
  if ((await scheduler.getPermission()) !== 'granted') return { status: 'no-permission', cancelled: await cancelAll() };
  const diff = diffReminders(scheduledIds, planReminders(loans, now));
  for (const id of diff.cancel) await scheduler.cancel(id);
  for (const reminder of diff.schedule) await scheduler.schedule(reminder);
  return { status: 'synced', scheduled: diff.schedule.map((r) => r.id), cancelled: diff.cancel };
}
