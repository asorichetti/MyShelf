import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { Button, EmptyState, Text, useSnackbar } from '@/components/ui';
import { pendingLookupsRepo, useDatabase, type PendingLookup } from '@/db';
import { formatDate, formatIsbn13, toIsoDate } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { SettingsPage } from './SettingsPage';

const T = Testids.pendingList;

const reasons: Record<string, string> = {
  'not-found': 'No book site knows this ISBN.',
  'invalid-isbn': 'This ISBN has a typo in it.',
};

/** What a queued lookup is doing, in words. */
export function pendingStatus(p: PendingLookup): string {
  if (p.attempts >= pendingLookupsRepo.MAX_LOOKUP_ATTEMPTS) return `Gave up. ${reasons[p.lastError ?? ''] ?? 'It didn’t work after several tries.'}`;
  if (p.attempts > 0) return `Waiting to try again (${p.attempts} ${p.attempts === 1 ? 'try' : 'tries'} so far).`;
  return 'Waiting for the internet.';
}

const added = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `Added ${formatDate(toIsoDate(d))}. `;
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
    show({ message: `Trying ${formatIsbn13(p.isbn13)} again` });
  };
  const remove = async (p: PendingLookup) => {
    await pendingLookupsRepo.remove(db, p.isbn13);
    emit('pending-changed');
    show({ message: `Removed ${formatIsbn13(p.isbn13)}` });
  };

  return (
    <SettingsPage
      title="Pending lookups"
      intro="Books you scanned or typed in while offline. MyShelf looks them up when you’re back online."
      testID={T.root}
      backTestID={T.back}
    >
      {list.length === 0 ? (
        <EmptyState
          testID={T.empty}
          illustration={<Booky expression="happy" size={96} />}
          title="Nothing waiting"
          message="Every book you’ve added has its details. Lovely."
        />
      ) : (
        <View role="list" aria-label="Pending lookups" style={{ gap: spacing.sm }}>
          {list.map((p) => (
            <View
              key={p.isbn13}
              role="listitem"
              testID={T.row}
              style={[styles.row, { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, boxShadow: theme.elevation.low }]}
            >
              <Text variant="mono">{`ISBN ${formatIsbn13(p.isbn13)}`}</Text>
              <Text variant="caption" color="inkMuted">
                {`${added(p.requestedAt)}${pendingStatus(p)}`}
              </Text>
              <View style={[styles.actions, { gap: spacing.sm }]}>
                <Button label="Retry" variant="secondary" accessibilityLabel={`Retry ${formatIsbn13(p.isbn13)}`} onPress={() => void retry(p)} testID={T.retry} />
                <Button label="Remove" variant="ghost" accessibilityLabel={`Remove ${formatIsbn13(p.isbn13)}`} onPress={() => void remove(p)} testID={T.remove} />
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
