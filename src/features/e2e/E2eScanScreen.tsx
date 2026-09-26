import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { Booky } from '@/components/booky';
import { EmptyState, Screen } from '@/components/ui';
import { NotFoundScreen } from '@/features/navigation/NotFoundScreen';
import { injectScan } from '@/features/scan/scanInjector';

import { isE2eEnabled } from './e2eFlag';

type Params = { isbn?: string; text?: string };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function Injector() {
  const params = useLocalSearchParams<Params>();
  const isbn = first(params.isbn)?.trim();
  const text = first(params.text)?.trim();
  useEffect(() => {
    if (isbn) injectScan({ isbn });
    else if (text) injectScan({ text });
    router.replace('/scan');
  }, [isbn, text]);
  return (
    <Screen pageState="loading" centered edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState illustration={<Booky expression="thinking" size={96} animated={false} />} headingLevel={1} title="Handing the scan over…" />
    </Screen>
  );
}

/**
 * `/e2e/scan?isbn=…` or `?text=…` (P03-07): gives the Scan tab a scan result
 * as if the camera or the cover reader had produced it, for Maestro and the
 * auto test suite. Only in builds with the E2E loader (ADR 0015); elsewhere
 * it is the not-found screen and does nothing.
 */
export function E2eScanScreen() {
  return isE2eEnabled() ? <Injector /> : <NotFoundScreen />;
}
