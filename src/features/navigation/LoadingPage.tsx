import { Screen, Text } from '@/components/ui';

/** A pushed page's loading state: one line of friendly text and the loading marker. */
export function LoadingPage({ message = 'Fetching the cards from the drawer…' }: { message?: string }) {
  return (
    <Screen pageState="loading" centered edges={['top', 'bottom', 'left', 'right']}>
      <Text color="inkMuted" align="center">
        {message}
      </Text>
    </Screen>
  );
}
