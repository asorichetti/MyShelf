import { useCallback } from 'react';

import { useSnackbar } from '@/components/ui';
import { booksRepo, useDatabase } from '@/db';
import { UNDO_WINDOW_MS } from '@/features/book/useDeleteBook';
import { emit } from '@/features/events';
import { deleteCover, isLocalCover } from '@/services/covers';

function announceChanges() {
  emit('library-changed');
  emit('loans-changed');
  emit('groups-changed');
}

const books = (n: number) => (n === 1 ? '1 book' : `${n} books`);

/**
 * Deletes several books in one transaction and offers Undo for six seconds,
 * which puts all of them back (as `useDeleteBook` does for one). Downloaded
 * cover files go once Undo is no longer on offer. Resolves to how many went.
 */
export function useDeleteBooks(): (ids: readonly number[]) => Promise<number> {
  const db = useDatabase();
  const { show } = useSnackbar();
  return useCallback(
    async (ids) => {
      const snapshots = await db.transaction(async (tx) => {
        const out: booksRepo.BookSnapshot[] = [];
        for (const id of ids) {
          const snapshot = await booksRepo.removeBook(tx, id);
          if (snapshot) out.push(snapshot);
        }
        return out;
      });
      if (!snapshots.length) return 0;
      announceChanges();
      show({
        message: `Removed ${books(snapshots.length)} from your shelf`,
        duration: UNDO_WINDOW_MS,
        action: {
          label: 'Undo',
          onPress: () => {
            db.transaction(async (tx) => {
              for (const snapshot of snapshots) await booksRepo.restoreBook(tx, snapshot);
            })
              .then(() => {
                announceChanges();
                show({ message: `${books(snapshots.length)} back on your shelf` });
              })
              .catch((e) => {
                console.error('Could not restore the books', e);
                show({ message: 'Sorry, I couldn’t bring those books back.' });
              });
          },
        },
        onHide: (reason) => {
          if (reason === 'action') return;
          for (const s of snapshots) if (isLocalCover(s.book.cover_uri as string | null)) deleteCover(s.book.id as number);
        },
      });
      return snapshots.length;
    },
    [db, show],
  );
}
