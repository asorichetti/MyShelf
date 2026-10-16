import { useEffect, useState } from 'react';

import { booksRepo, useDatabase } from '@/db';
import { useLibraryEvent } from '@/features/events';

export interface CollectionStats {
  /** Number of books that have a value set. */
  valuedCount: number;
  /** Sum of all book values. */
  totalValue: number;
}

/**
 * Reads the collection's total value and how many books have a value set.
 * Refreshes automatically when books change.
 */
export function useCollectionStats(): CollectionStats {
  const db = useDatabase();
  const [stats, setStats] = useState<CollectionStats>({ valuedCount: 0, totalValue: 0 });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    booksRepo
      .collectionStats(db)
      .then((s) => active && setStats(s))
      .catch((e) => console.error('Could not compute collection stats', e));
    return () => {
      active = false;
    };
  }, [db, version]);

  useLibraryEvent('library-changed', () => setVersion((v) => v + 1));

  return stats;
}
