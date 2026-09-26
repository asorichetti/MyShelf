import { createContext, useContext, type ReactNode } from 'react';

import { PendingBanner } from '@/components/book/PendingBanner';

import { usePendingLookups, type PendingLookups } from './usePendingLookups';

const PendingLookupsContext = createContext<PendingLookups | null>(null);

/**
 * Runs the offline lookup queue and the cover backfill (P02-10, P02-16) for
 * the app shell. Mounted once in the tab layout, not the root, so it starts
 * after an E2E fixture has loaded rather than racing it.
 */
export function PendingLookupsProvider({ children }: { children: ReactNode }) {
  const value = usePendingLookups();
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
  return <PendingBanner count={pending.pending.length} retrying={pending.retrying} onRetry={() => void pending.retryNow()} />;
}
