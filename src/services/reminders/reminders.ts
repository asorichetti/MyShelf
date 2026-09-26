import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { REMINDER_CHANNEL } from './plan';

import type { ReminderPermission, ReminderScheduler } from './types';

let prepared = false;

/** Shows reminders while the app is open too, and creates the Android channel once. */
async function prepare(): Promise<void> {
  if (prepared) return;
  prepared = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Loan reminders',
      description: 'A note on the day a lent book is due back',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

const toPermission = (p: Notifications.NotificationPermissionsStatus): ReminderPermission =>
  p.granted ? 'granted' : p.status === 'denied' ? 'denied' : 'undetermined';

/** Local notifications through expo-notifications. No push service, nothing leaves the phone. */
export const reminderScheduler: ReminderScheduler = {
  supported: true,
  async getPermission() {
    return toPermission(await Notifications.getPermissionsAsync());
  },
  async requestPermission() {
    await prepare();
    return toPermission(await Notifications.requestPermissionsAsync());
  },
  async scheduledIds() {
    return (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier);
  },
  async schedule(reminder) {
    await prepare();
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: reminder.title, body: reminder.body, data: { url: reminder.url, loanId: reminder.loanId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: REMINDER_CHANNEL },
    });
  },
  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
  onOpen(open) {
    const handle = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) open(url);
    };
    handle(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  },
};
