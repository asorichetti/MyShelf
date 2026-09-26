import { useReminderSync } from './useReminderSync';

/** App-wide lending upkeep: due-date reminders. Renders nothing. */
export function LoanWatchers() {
  useReminderSync();
  return null;
}
