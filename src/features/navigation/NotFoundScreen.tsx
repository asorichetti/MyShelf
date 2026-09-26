import { router } from 'expo-router';

import { Booky } from '@/components/booky';
import { EmptyState, Screen } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';

export function NotFoundScreen() {
  return (
    <Screen testID={Testids.notFound.root} centered edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState
        illustration={<Booky expression="concerned" size={120} />}
        headingLevel={1}
        title="Page not found"
        titleTestID={Testids.notFound.title}
        message="I've searched every shelf, but this page isn't in the catalogue."
        action={{
          label: 'Back to my shelf',
          onPress: () => router.replace('/'),
          testID: Testids.notFound.homeLink,
        }}
      />
    </Screen>
  );
}
