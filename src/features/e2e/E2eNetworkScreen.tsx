import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect } from 'react';

import { Booky } from '@/components/booky';
import { EmptyState, Screen } from '@/components/ui';
import { NotFoundScreen } from '@/features/navigation/NotFoundScreen';
import { t } from '@/i18n';

import { isE2eEnabled, safeNextPath } from './e2eFlag';
import { isMockApiBuilt, setE2eApiState } from './mockApi';

type Params = { state?: string; next?: string };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function Switcher() {
  const params = useLocalSearchParams<Params>();
  const state = first(params.state);
  const next = safeNextPath(first(params.next));
  useEffect(() => {
    if (state === 'online' || state === 'offline') setE2eApiState({ network: state });
    router.replace(next as Href);
  }, [state, next]);
  return (
    <Screen pageState="loading" centered edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState illustration={<Booky expression="thinking" size={96} animated={false} />} headingLevel={1} title={t('e2e.switchingNetwork')} />
    </Screen>
  );
}

/**
 * `/e2e/network?state=online|offline&next=<route>`: turns the Android E2E
 * build's simulated network on or off (`mockApi.ts`) without touching the
 * library, then redirects; the offline queue flows use it instead of airplane
 * mode, so they need no real network either. Only in the E2E APK; elsewhere
 * it is the not-found screen and does nothing.
 */
export function E2eNetworkScreen() {
  return isE2eEnabled() && isMockApiBuilt() ? <Switcher /> : <NotFoundScreen />;
}
