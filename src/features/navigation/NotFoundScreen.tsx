import { router } from 'expo-router';

import { Booky } from '@/components/booky';
import { EmptyState, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';

export function NotFoundScreen() {
  return (
    <Screen testID={Testids.notFound.root} centered edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState
        testID={Testids.emptyState.root}
        illustration={<Booky expression="concerned" size={120} />}
        headingLevel={1}
        title={t('navigation.notFound.title')}
        titleTestID={Testids.notFound.title}
        message={t('navigation.notFound.message')}
        action={{
          label: t('navigation.notFound.home'),
          onPress: () => router.replace('/'),
          testID: Testids.notFound.homeLink,
        }}
      />
    </Screen>
  );
}
