import { Booky } from '@/components/booky';
import { EmptyState, Heading, Screen } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';

export function SettingsScreen() {
  return (
    <Screen testID={Testids.settings.root}>
      <Heading level={1} testID={Testids.settings.title}>
        Settings
      </Heading>
      <EmptyState
        illustration={<Booky expression="sleepy" size={112} />}
        title="Nothing to tweak yet"
        message="Settings are having a little nap. They'll wake up as MyShelf grows."
      />
    </Screen>
  );
}
