import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Booky } from '@/components/booky';
import { Button, EmptyState, Screen, Text, type ErrorFallbackProps } from '@/components/ui';
import { goToShelf } from '@/features/settings/goToShelf';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { COPY_ERROR_LABEL, copyErrorDetails } from './copyErrorDetails';
import { errorDetails } from './errorDetails';

const T = Testids.errorBoundary;

export interface ScreenErrorScreenProps extends ErrorFallbackProps {
  /** The route that failed (`loans`, `book/[id]`), for the error details. */
  where: string;
}

/**
 * What a screen shows instead of itself when it crashes while rendering
 * (P09-04): concerned Booky, "Try again" (renders the screen afresh), a way
 * back to the Shelf, and the error details to copy. The tabs and every other
 * screen keep working.
 */
export function ScreenErrorScreen({ error, componentStack, retry, where }: ScreenErrorScreenProps) {
  const { spacing } = useTheme();
  const [copied, setCopied] = useState<boolean | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const copy = async () => {
    const ok = await copyErrorDetails(errorDetails(error, where, componentStack));
    if (mounted.current) setCopied(ok);
  };

  return (
    <Screen pageState="error" testID={T.root} centered>
      <EmptyState
        illustration={<Booky expression="concerned" size={120} />}
        headingLevel={1}
        title="Something went wrong here"
        titleTestID={T.title}
        message="This page tripped over something. Your books are safe; let’s try that again."
        action={{ label: 'Try again', onPress: retry, testID: T.retry }}
        secondaryAction={where === 'index' || where === 'app' ? undefined : { label: 'Go to my shelf', onPress: goToShelf }}
      />
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Button variant="ghost" label={COPY_ERROR_LABEL} onPress={() => void copy()} testID={T.copy} />
        {copied != null ? (
          <Text variant="caption" color="inkMuted" align="center" role="status" aria-live="polite" accessibilityLiveRegion="polite" testID={T.copied}>
            {copied ? 'Copied. It stays on this phone unless you paste it somewhere.' : 'Couldn’t copy them; the details are below.'}
          </Text>
        ) : null}
        <Text variant="caption" color="inkMuted" align="center" selectable testID={T.details}>
          {`${error.name}: ${error.message}`}
        </Text>
      </View>
    </Screen>
  );
}
