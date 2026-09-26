import { Booky } from '@/components/booky';
import { EmptyState, Heading, Screen } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';

export function GroupsScreen() {
  return (
    <Screen testID={Testids.groups.root}>
      <Heading level={1} testID={Testids.groups.title}>
        Groups
      </Heading>
      <EmptyState
        testID={Testids.emptyState.root}
        illustration={<Booky expression="happy" size={112} />}
        title="No groups yet"
        message="Browse by genre, series or author, or make your own shelves like “Summer reads”."
      />
    </Screen>
  );
}
