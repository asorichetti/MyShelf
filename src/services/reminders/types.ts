import type { ReminderRequest } from './plan';

/** `granted` to schedule; `denied` once the user said no; `unsupported` on web. */
export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** The platform's local notifications, behind an interface so the sync logic is testable. */
export interface ReminderScheduler {
  /** False on web: reminders are a phone feature. */
  readonly supported: boolean;
  getPermission(): Promise<ReminderPermission>;
  /** Asks the user (only called when they turn reminders on). */
  requestPermission(): Promise<ReminderPermission>;
  /** Ids of every scheduled local notification. */
  scheduledIds(): Promise<string[]>;
  schedule(reminder: ReminderRequest): Promise<void>;
  cancel(id: string): Promise<void>;
  /** Calls `open(url)` when the user taps a reminder (also one that launched the app). Returns an unsubscribe. */
  onOpen(open: (url: string) => void): () => void;
}
