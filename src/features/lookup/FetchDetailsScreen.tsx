import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RefreshFieldRow } from '@/components/book/RefreshFieldRow';
import { Booky, BookyBubble } from '@/components/booky';
import { SettingsNotice } from '@/components/settings/SettingsControls';
import { Button, Heading, Text } from '@/components/ui';
import { joinNames } from '@/domain';
import { goBackOr } from '@/features/navigation/goBack';
import { goToShelf } from '@/features/settings/goToShelf';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useFetchDetails, type DetailsCounts } from './useFetchDetails';

const T = Testids.fetchDetails;

/** The book ids in `?ids=3,4,5`, in order, valid ones only. */
export function parseBookIds(raw: string | string[] | undefined): number[] {
  const text = Array.isArray(raw) ? raw.join(',') : raw ?? '';
  const ids = text
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(ids)];
}

function summary(counts: DetailsCounts): string {
  const parts = [
    counts.found ? t('fetchDetails.found', { count: counts.found }) : null,
    counts.upToDate ? t('fetchDetails.upToDate', { count: counts.upToDate }) : null,
    counts.notFound ? t('fetchDetails.notFound', { count: counts.notFound }) : null,
    counts.failed ? t('fetchDetails.failed', { count: counts.failed }) : null,
  ];
  return parts.filter(Boolean).join(' ');
}

/**
 * `/settings/fetch-details?ids=…` (P08-05): the books just imported from a
 * spreadsheet are looked up, and what the catalogues could add is listed
 * book by book, field by field, as in "Refresh details". Every offered
 * detail is ticked; untick what you don't want, then add the rest.
 */
export function FetchDetailsScreen() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const bookIds = useMemo(() => parseBookIds(ids), [ids]);
  const fetch = useFetchDetails(bookIds);
  const { state, ticked } = fetch;
  const { spacing } = useTheme();
  const [saveError, setSaveError] = useState(false);
  const tickedCount = [...ticked.values()].reduce((n, fields) => n + fields.size, 0);

  const apply = async () => {
    setSaveError(false);
    try {
      await fetch.apply();
    } catch (e) {
      console.error('Could not save the fetched details', e);
      setSaveError(true);
    }
  };

  return (
    <SettingsPage title={t('fetchDetails.title')} intro={t('fetchDetails.intro')} testID={T.root} backTestID={T.back}>
      {state.status === 'checking' ? (
        <View style={{ gap: spacing.md }}>
          <View role="status" aria-live="polite" accessibilityLiveRegion="polite" testID={T.progress}>
            <BookyBubble expression="thinking" message={t('fetchDetails.checking', { done: state.done, total: state.total, count: state.total })} />
          </View>
          <Button label={t('fetchDetails.stop')} variant="secondary" onPress={fetch.stop} testID={T.stop} />
        </View>
      ) : null}

      {state.status === 'review' ? (
        <View style={{ gap: spacing.lg }}>
          {state.offline ? (
            <SettingsNotice tone="warn" testID={T.offline}>
              {t('fetchDetails.offline')}
            </SettingsNotice>
          ) : null}
          <Text role="status" aria-live="polite" accessibilityLiveRegion="polite" testID={T.summary}>
            {summary(state.counts)}
          </Text>
          {state.proposals.length ? (
            <>
              {state.proposals.map(({ book, changes }) => (
                <View key={book.id} testID={T.book} style={{ gap: spacing.sm }}>
                  <View style={{ gap: spacing.xxs }}>
                    <Heading level={2}>{book.title}</Heading>
                    {book.authors.length ? (
                      <Text variant="mono" color="inkMuted">
                        {joinNames(book.authors.map((a) => a.name))}
                      </Text>
                    ) : null}
                  </View>
                  <View role="group" aria-label={t('fetchDetails.bookChanges', { title: book.title })} style={{ gap: spacing.sm }}>
                    {changes.map((change) => (
                      <RefreshFieldRow
                        key={change.field}
                        change={change}
                        checked={ticked.get(book.id)?.has(change.field) ?? false}
                        onToggle={() => fetch.toggle(book.id, change.field)}
                      />
                    ))}
                  </View>
                </View>
              ))}
              {saveError ? (
                <SettingsNotice tone="danger">{t('fetchDetails.saveFailed')}</SettingsNotice>
              ) : null}
              <View style={[styles.actions, { gap: spacing.sm }]}>
                <Button variant="ghost" label={t('fetchDetails.notNow')} onPress={() => goBackOr('/settings')} testID={T.cancel} />
                <Button
                  label={tickedCount ? t('fetchDetails.apply', { count: tickedCount }) : t('fetchDetails.nothingTicked')}
                  onPress={() => void apply()}
                  disabled={!tickedCount}
                  loading={fetch.applying}
                  testID={T.apply}
                />
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.md }}>
              <Booky expression="happy" size={96} />
              <Heading level={2}>{t('fetchDetails.nothingTitle')}</Heading>
              <Text color="inkMuted" align="center">
                {t('fetchDetails.nothingMessage')}
              </Text>
              <Button label={t('fetchDetails.seeShelf')} onPress={goToShelf} testID={T.done} />
            </View>
          )}
        </View>
      ) : null}

      {state.status === 'saved' ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ alignItems: 'center' }}>
            <Booky expression="excited" size={96} />
          </View>
          <SettingsNotice tone="success" testID={T.saved} focusOnShow>
            {t('fetchDetails.saved', { count: state.books })}
          </SettingsNotice>
          <Button label={t('fetchDetails.seeShelf')} block onPress={goToShelf} testID={T.done} />
        </View>
      ) : null}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap' },
});
