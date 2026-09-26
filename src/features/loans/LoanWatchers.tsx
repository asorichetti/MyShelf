import { useOverdueNudge } from './useOverdueNudge';
import { useReminderSync } from './useReminderSync';

/** App-wide lending upkeep: due-date reminders and Booky's overdue nudge. Renders nothing. */
export function LoanWatchers() {
  useReminderSync();
  useOverdueNudge();
  return null;
}
