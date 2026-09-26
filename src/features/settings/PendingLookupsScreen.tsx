import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { Button, EmptyState, Text, useSnackbar } from '@/components/ui';
import { pendingLookupsRepo, useDatabase, type PendingLookup } from '@/db';
import { formatDate, formatIsbn13, toIsoDate } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { t, translate, type MessageKey } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { SettingsPage } from './SettingsPage';

const T = Testids.pendingList;

const reasons: Record<string, MessageKey> = {
  'not-found': 'pendingLookups.status.notFound',
  'invalid-isbn': 'pendingLookups.status.invalidIsbn',
};

/** What a queued lookup is doing, in words. */
export function pendingStatus(p: PendingLookup): string {
  if (p.attempts >= pendingLookupsRepo.MAX_LOOKUP_ATTEMPTS) {
    return t('pendingLookups.status.gaveUp', { reason: translate(reasons[p.lastError ?? ''] ?? 'pendingLookups.status.unknownError') });
  }
  if (p.attempts > 0) return t('pendingLookups.status.retrying', { count: p.attempts });
  return t('pendingLookups.status.waiting');
}

/** A queued lookup's line: when it was added (if known), then its status. */
const details = (p: PendingLookup) => {
  const d = new Date(p.requestedAt);
  const status = pendingStatus(p);
  return Number.isNaN(d.getTime()) ? status : t('pendingLookups.addedOn', { date: formatDate(toIsoDate(d)), status });
};

/**
 * Settings → Pending lookups (P08-10): ISBNs scanned or typed while offline.
 * Retry puts one back in the queue and tries now; Remove drops it. The
 * Shelf's "waiting for details" banner follows at once.
 */
export function PendingLookupsScreen() {
  const db = useDatabase();
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const { show } = useSnackbar();
  const [list, setList] = useState<PendingLookup[] | null>(null);

  const load = useCallback(() => {
    pendingLookupsRepo
      .list(db)
      .then(setList)
      .catch((e) => console.error('Could not list pending lookups', e));
  }, [db]);
  useEffect(load, [load]);
  useLibraryEvent(['pending-changed', 'library-changed'], load);

  if (!list) return <LoadingPage />;

  const retry = async (p: PendingLookup) => {
    await pendingLookupsRepo.resetAttempts(db, p.isbn13);
    emit('pending-changed');
    emit('pending-retry');
    show({ message: t('pendingLookups.retrying', { isbn: formatIsbn13(p.isbn13) }) });
  };
  const remove = async (p: PendingLookup) => {
    await pendingLookupsRepo.remove(db, p.isbn13);
    emit('pending-changed');
    show({ message: t('pendingLookups.removed', { isbn: formatIsbn13(p.isbn13) }) });
  };

  return (
    <SettingsPage
      title={t('pendingLookups.title')}
      intro={t('pendingLookups.intro')}
      testID={T.root}
      backTestID={T.back}
    >
      {list.length === 0 ? (
        <EmptyState
          testID={T.empty}
          illustration={<Booky expression="happy" size={96} />}
          title={t('pendingLookups.emptyTitle')}
          message={t('pendingLookups.emptyMessage')}
        />
      ) : (
        <View role="list" aria-label={t('pendingLookups.listLabel')} style={{ gap: spacing.sm }}>
          {list.map((p) => (
            <View
              key={p.isbn13}
              role="listitem"
              testID={T.row}
              style={[styles.row, { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, boxShadow: theme.elevation.low }]}
            >
              <Text variant="mono">{t('pendingLookups.isbn', { isbn: formatIsbn13(p.isbn13) })}</Text>
              <Text variant="caption" color="inkMuted">
                {details(p)}
              </Text>
              <View style={[styles.actions, { gap: spacing.sm }]}>
                <Button label={t('common.retry')} variant="secondary" accessibilityLabel={t('pendingLookups.retryLabel', { isbn: formatIsbn13(p.isbn13) })} onPress={() => void retry(p)} testID={T.retry} />
                <Button label={t('common.remove')} variant="ghost" accessibilityLabel={t('pendingLookups.removeLabel', { isbn: formatIsbn13(p.isbn13) })} onPress={() => void remove(p)} testID={T.remove} />
              </View>
            </View>
          ))}
        </View>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});
