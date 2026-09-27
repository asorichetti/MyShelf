import { useCallback } from 'react';

import { useSnackbar } from '@/components/ui';
import { booksRepo, useDatabase } from '@/db';
import { UNDO_WINDOW_MS } from '@/features/book/useDeleteBook';
import { deleteCoverOfDeletedBook } from '@/features/covers';
import { emit } from '@/features/events';
import { t } from '@/i18n';
import { isLocalCover } from '@/services/covers';

function announceChanges() {
  emit('library-changed');
  emit('loans-changed');
  emit('groups-changed');
}

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
        message: t('shelf.removed.message', { count: snapshots.length }),
        duration: UNDO_WINDOW_MS,
        action: {
          label: t('common.undo'),
          onPress: () => {
            db.transaction(async (tx) => {
              for (const snapshot of snapshots) await booksRepo.restoreBook(tx, snapshot);
            })
              .then(() => {
                announceChanges();
                show({ message: t('shelf.removed.restored', { count: snapshots.length }) });
              })
              .catch((e) => {
                console.error('Could not restore the books', e);
                show({ message: t('shelf.removed.restoreFailed') });
              });
          },
        },
        onHide: (reason) => {
          if (reason === 'action') return;
          for (const s of snapshots) if (isLocalCover(s.book.cover_uri as string | null)) void deleteCoverOfDeletedBook(db, s.book.id as number);
        },
      });
      return snapshots.length;
    },
    [db, show],
  );
}
