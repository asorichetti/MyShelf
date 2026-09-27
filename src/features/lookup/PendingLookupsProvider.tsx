import { router } from 'expo-router';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ArrivedBanner, PendingBanner } from '@/components/book/PendingBanner';
import { bookCount, tipById, formatTip } from '@/components/booky';
import { Button, Text } from '@/components/ui';
import { useDatabase } from '@/db';
import { formatIsbn13 } from '@/domain';
import { backfillCoversNow } from '@/features/covers';
import { emit } from '@/features/events';
import { createSession } from '@/features/scan/sessionStore';
import { t } from '@/i18n';

import { usePendingLookups, type PendingLookups } from './usePendingLookups';

const PendingLookupsContext = createContext<PendingLookups | null>(null);

/**
 * Runs the offline lookup queue and the cover backfill (P02-10, P02-16) for
 * the app shell. Mounted once in the tab layout, not the root, so it starts
 * after an E2E fixture has loaded rather than racing it.
 */
export function PendingLookupsProvider({ children }: { children: ReactNode }) {
  const db = useDatabase();
  // Screens showing covers reload when the backfill found some.
  const backfillCovers = useCallback(
    (signal: AbortSignal) =>
      backfillCoversNow(db, { signal }).then((summary) => {
        if (summary.attached) emit('library-changed');
        return summary;
      }),
    [db],
  );
  const value = usePendingLookups({ backfillCovers });
  return <PendingLookupsContext.Provider value={value}>{children}</PendingLookupsContext.Provider>;
}

/** The shared queue, or null outside the tab shell (a stack screen opened directly). */
export function usePendingLookupsContext(): PendingLookups | null {
  return useContext(PendingLookupsContext);
}

/** The Shelf's "N books waiting for details" banner, fed by the shared queue. */
export function ShelfPendingBanner() {
  const pending = usePendingLookupsContext();
  if (!pending) return null;
  const failed = pending.failed;
  const [first] = pending.results;
  // The edition picker, as for a scanned barcode; saving the book there takes it out of the queue.
  const review = () => {
    if (!first) return;
    const session = createSession({ source: 'isbn', isbn13: first.isbn13, candidates: first.candidates });
    router.navigate({ pathname: '/scan/pick', params: { session: session.id } });
  };
  return (
    <>
      {first ? <ArrivedBanner count={pending.results.length} isbn={formatIsbn13(first.isbn13)} onReview={review} /> : null}
      <PendingBanner count={pending.pending.length} retrying={pending.retrying} onRetry={() => pending.retryNow().catch((error) => console.warn('Could not retry the pending lookups', error))} />
      {failed.length ? (
        // Booky says this in a tip too; it stays here, in the screen, until the user has read it (P07-09).
        <View style={styles.row}>
          <Text role="status" color="inkMuted" style={styles.fill}>
            {formatTip(tipById('lookup-gave-up').text, { books: bookCount(failed.length), them: t('lookup.pending.them', { count: failed.length }) })}
          </Text>
          <Button variant="ghost" label={t('lookup.pending.ok')} accessibilityLabel={t('lookup.pending.okLabel')} onPress={() => failed.forEach((f) => void pending.remove(f.isbn13))} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  fill: { flex: 1, minWidth: 200 },
});
