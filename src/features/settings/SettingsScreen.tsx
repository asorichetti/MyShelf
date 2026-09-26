import { View } from 'react-native';

import { Booky } from '@/components/booky';
import { ReminderSwitch } from '@/components/loans/ReminderSwitch';
import { EmptyState, Heading, Screen } from '@/components/ui';
import { useReminderSetting } from '@/features/loans/useReminderSync';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

function LendingSettings() {
  const { spacing } = useTheme();
  const reminders = useReminderSetting();
  const note = !reminders.supported
    ? 'Reminders work in the Android app.'
    : reminders.denied
      ? 'Notifications are turned off for MyShelf. You can allow them in your phone’s settings, then try again.'
      : null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Heading level={2}>Lending</Heading>
      <ReminderSwitch value={reminders.enabled === true} onChange={(on) => void reminders.setEnabled(on)} disabled={!reminders.supported || reminders.busy} note={note} />
    </View>
  );
}

export function SettingsScreen() {
  return (
    <Screen testID={Testids.settings.root}>
      <Heading level={1} testID={Testids.settings.title}>
        Settings
      </Heading>
      <LendingSettings />
      <EmptyState
        testID={Testids.emptyState.root}
        illustration={<Booky expression="sleepy" size={96} />}
        title="More settings soon"
        message="The rest are having a little nap. They'll wake up as MyShelf grows."
      />
    </Screen>
  );
}
