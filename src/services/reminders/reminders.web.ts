import type { ReminderScheduler } from './types';

/** Web: no reminders (the web build is a test target); every call is a no-op. */
export const reminderScheduler: ReminderScheduler = {
  supported: false,
  getPermission: async () => 'unsupported',
  requestPermission: async () => 'unsupported',
  scheduledIds: async () => [],
  schedule: async () => {},
  cancel: async () => {},
  onOpen: () => () => {},
};
