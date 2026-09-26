import { Booky } from '@/components/booky';
import { EmptyState, Screen } from '@/components/ui';

import { goBackOr } from './goBack';

import type { Href } from 'expo-router';

export interface MissingScreenProps {
  title: string;
  message: string;
  /** Where "Back" goes when there is no history. */
  fallback?: Href;
}

/** Shown for an id that no longer exists (deleted, merged or mistyped). */
export function MissingScreen({ title, message, fallback = '/' }: MissingScreenProps) {
  return (
    <Screen pageState="error" centered edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState
        illustration={<Booky expression="concerned" size={120} />}
        headingLevel={1}
        title={title}
        message={message}
        action={{ label: 'Go back', onPress: () => goBackOr(fallback) }}
      />
    </Screen>
  );
}
