import { Screen, Text } from '@/components/ui';
import { t } from '@/i18n';


/** A pushed page's loading state: one line of friendly text and the loading marker. */
export function LoadingPage({ message }: { message?: string }) {
  return (
    <Screen pageState="loading" centered edges={['top', 'bottom', 'left', 'right']}>
      <Text color="inkMuted" align="center">
        {message ?? t('navigation.loading.page')}
      </Text>
    </Screen>
  );
}
