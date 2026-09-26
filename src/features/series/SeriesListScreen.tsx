import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { SeriesRow } from '@/components/series/SeriesRow';
import { Chip, EmptyState, Heading, IconButton, Screen, Text } from '@/components/ui';
import type { SeriesSort } from '@/db';
import { goBackOrShelf } from '@/features/book/BookDetailScreen';
import { t, translate, type MessageKey } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useSeriesList } from './useSeriesList';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

const sorts: { sort: SeriesSort; label: MessageKey; testID: string }[] = [
  { sort: 'name', label: 'series.list.sortName', testID: Testids.seriesList.sortName },
  { sort: 'recent', label: 'series.list.sortRecent', testID: Testids.seriesList.sortRecent },
];

/** `/series`: every series with a mini shelf and "5 of 9" (P04-04). */
export function SeriesListScreen() {
  const { spacing } = useTheme();
  const { status, series, sort, setSort } = useSeriesList();

  if (status === 'loading') {
    return (
      <Screen pageState="loading" centered edges={[...EDGES]}>
        <Text color="inkMuted" align="center">
          {t('series.list.loading')}
        </Text>
      </Screen>
    );
  }

  const header = (
    <View style={[styles.bar, { gap: spacing.xs, marginTop: -spacing.sm, marginHorizontal: -spacing.sm }]}>
      <IconButton icon="arrow-left" accessibilityLabel={t('common.back')} onPress={goBackOrShelf} />
    </View>
  );

  if (status === 'error') {
    return (
      <Screen pageState="error" centered edges={[...EDGES]}>
        <EmptyState illustration={<Booky expression="concerned" size={96} />} headingLevel={1} title={t('series.list.errorTitle')} message={t('series.list.errorMessage')} />
      </Screen>
    );
  }

  return (
    <Screen testID={Testids.seriesList.root} edges={[...EDGES]}>
      {header}
      <View style={{ gap: spacing.xs }}>
        <Heading level={1} testID={Testids.seriesList.title}>
          {t('series.list.title')}
        </Heading>
        <Text color="inkMuted">
          {series.length ? t('series.list.intro') : t('series.list.introEmpty')}
        </Text>
      </View>
      {series.length ? (
        <>
          <View role="radiogroup" aria-label={t('series.list.sortLabel')} style={[styles.wrap, { columnGap: spacing.sm }]}>
            {sorts.map((s) => (
              <Chip key={s.sort} label={translate(s.label)} role="radio" selected={sort === s.sort} onPress={() => setSort(s.sort)} testID={s.testID} />
            ))}
          </View>
          <View role="list" aria-label={t('series.list.listLabel')} style={{ gap: spacing.md }}>
            {series.map((s) => (
              <View role="listitem" key={s.id}>
                <SeriesRow series={s} onPress={(id) => router.push({ pathname: '/series/[id]', params: { id: String(id) } })} />
              </View>
            ))}
          </View>
        </>
      ) : (
        <EmptyState
          testID={Testids.seriesList.empty}
          illustration={<Booky expression="sleepy" size={96} />}
          title={t('series.list.emptyTitle')}
          message={t('series.list.emptyMessage')}
          action={{ label: t('common.addABook'), onPress: () => router.navigate('/book/new'), variant: 'secondary' }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
