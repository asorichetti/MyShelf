import { Booky } from '@/components/booky';
import { EmptyState, Screen, Text } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';

export function DatabaseErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <Screen pageState="error" testID={Testids.dbError.root} centered edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState
        illustration={<Booky expression="concerned" size={120} />}
        headingLevel={1}
        title="I couldn't open your library"
        titleTestID={Testids.dbError.title}
        message="Something went wrong opening the catalogue on this device. Your books are safe; let's try again."
        action={{ label: 'Try again', onPress: onRetry, testID: Testids.dbError.retry }}
      />
      <Text variant="caption" color="inkMuted" align="center" selectable>
        {error.message}
      </Text>
    </Screen>
  );
}
