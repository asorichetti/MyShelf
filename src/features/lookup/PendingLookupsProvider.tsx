import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PendingBanner } from '@/components/book/PendingBanner';
import { bookCount, tipById, formatTip } from '@/components/booky';
import { Button, Text } from '@/components/ui';
import { useDatabase } from '@/db';
import { backfillCoversNow } from '@/features/covers';
import { emit } from '@/features/events';

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
  return (
    <>
      <PendingBanner count={pending.pending.length} retrying={pending.retrying} onRetry={() => void pending.retryNow()} />
      {failed.length ? (
        // Booky says this in a tip too; it stays here, in the screen, until the user has read it (P07-09).
        <View style={styles.row}>
          <Text role="status" color="inkMuted" style={styles.fill}>
            {formatTip(tipById('lookup-gave-up').text, { books: bookCount(failed.length), them: failed.length === 1 ? 'it' : 'them' })}
          </Text>
          <Button variant="ghost" label="OK" accessibilityLabel="OK, forget those lookups" onPress={() => failed.forEach((f) => void pending.remove(f.isbn13))} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  fill: { flex: 1, minWidth: 200 },
});
