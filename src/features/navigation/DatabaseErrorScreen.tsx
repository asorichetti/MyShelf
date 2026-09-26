import { Booky } from '@/components/booky';
import { EmptyState, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';

export function DatabaseErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <Screen pageState="error" testID={Testids.dbError.root} centered edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState
        testID={Testids.emptyState.root}
        illustration={<Booky expression="concerned" size={120} />}
        headingLevel={1}
        title={t('navigation.databaseError.title')}
        titleTestID={Testids.dbError.title}
        message={t('navigation.databaseError.message')}
        action={{ label: t('common.tryAgain'), onPress: onRetry, testID: Testids.dbError.retry }}
      />
      <Text variant="caption" color="inkMuted" align="center" selectable>
        {error.message}
      </Text>
    </Screen>
  );
}
