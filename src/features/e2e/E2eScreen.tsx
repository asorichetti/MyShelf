import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { Booky } from '@/components/booky';
import { EmptyState, Screen, Text } from '@/components/ui';
import { useDatabase } from '@/db';
import { isIsoDate, setToday } from '@/domain';
import { emit } from '@/features/events';
import { NotFoundScreen } from '@/features/navigation/NotFoundScreen';
import { t } from '@/i18n';
import { fixtureNames, isFixtureName } from '@/testing/fixtures';
import { loadFixture } from '@/testing/loadFixture';

import { armCrash } from './crashSwitch';
import { isE2eEnabled, safeNextPath } from './e2eFlag';
import { beginFixtureVisit } from './fixtureVisit';
import { setE2eApiState } from './mockApi';
import { settleFixtureCovers } from './settleFixtureCovers';

type Params = { fixture?: string; next?: string; today?: string; crash?: string; api?: string; network?: string };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function FixtureLoader() {
  const db = useDatabase();
  const params = useLocalSearchParams<Params>();
  const fixture = first(params.fixture) ?? '';
  const next = safeNextPath(first(params.next));
  const frozen = first(params.today);
  const crash = first(params.crash);
  const api = first(params.api) ?? 'mock';
  const network = first(params.network) ?? 'online';
  const problem = !isFixtureName(fixture)
    ? t('e2e.unknownFixture', { name: fixture, names: fixtureNames.join(t('common.list.separator')) })
    : frozen != null && !isIsoDate(frozen)
      ? t('e2e.badToday', { value: frozen })
      : api !== 'mock' && api !== 'live'
        ? t('e2e.badSwitch', { name: 'api', value: api, values: 'mock, live' })
        : network !== 'online' && network !== 'offline'
          ? t('e2e.badSwitch', { name: 'network', value: network, values: 'online, offline' })
          : null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (problem || !isFixtureName(fixture)) return;
    let active = true;
    // Booky's start-up checks stay quiet for this visit, however late the start-up events arrive.
    beginFixtureVisit();
    if (frozen != null) setToday(frozen);
    // Android E2E build: recorded API responses unless the flow asks for the real services (mockApi.ts).
    setE2eApiState({ api: api === 'live' ? 'live' : 'mock', network: network === 'offline' ? 'offline' : 'online' });
    loadFixture(db, fixture)
      .then(() => settleFixtureCovers(db))
      .then(() => {
        // Settings such as Booky's memory and the first-run flag changed underneath.
        emit('settings-changed');
        // `crash=<route>`: that screen throws while rendering until its error boundary has caught it (P09-04).
        if (crash) armCrash(crash);
        if (active) router.replace(next as Href);
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [db, fixture, next, frozen, crash, problem, api, network]);

  const message = problem ?? error;
  if (message) {
    return (
      <Screen pageState="error" centered edges={['top', 'bottom', 'left', 'right']}>
        <EmptyState illustration={<Booky expression="concerned" size={96} />} headingLevel={1} title={t('e2e.loadFailed')} />
        <Text align="center" color="inkMuted" selectable>
          {message}
        </Text>
      </Screen>
    );
  }
  return (
    <Screen pageState="loading" centered scroll={false} edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState illustration={<Booky expression="thinking" size={96} animated={false} />} headingLevel={1} title={t('e2e.loading')} />
    </Screen>
  );
}

/**
 * `/e2e?fixture=<name>&next=<route>[&today=YYYY-MM-DD][&crash=<route name>][&api=mock|live][&network=online|offline]`:
 * wipes the library, loads a fixture, optionally arms a render error in one
 * screen (`crashSwitch.ts`), sets the Android E2E build's API switch
 * (`mockApi.ts`: recorded responses unless `api=live`; `network=offline`
 * fails every request as with no network) and redirects. Only in builds with EXPO_PUBLIC_E2E=1; in
 * every other build it is the not-found screen and touches nothing.
 */
export function E2eScreen() {
  return isE2eEnabled() ? <FixtureLoader /> : <NotFoundScreen />;
}
