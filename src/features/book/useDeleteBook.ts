import { useCallback } from 'react';

import { useSnackbar } from '@/components/ui';
import { booksRepo, useDatabase } from '@/db';
import { holdCover, releaseCoverOfDeletedBook, unholdCover } from '@/features/covers';
import { emit } from '@/features/events';
import { t } from '@/i18n';

/** How long "Undo" is offered after a delete. */
export const UNDO_WINDOW_MS = 6000;

function announceChanges() {
  emit('library-changed');
  emit('loans-changed');
  emit('groups-changed');
}

/**
 * Deletes a book in one transaction and offers Undo in a snackbar for six
 * seconds, which puts the whole book back (authors, genres, series, groups
 * and loans, same id). Its cover file is held while Undo is on offer, then
 * deleted unless something else names it (`releaseCover`).
 */
export function useDeleteBook(): (book: { id: number; title: string }) => Promise<boolean> {
  const db = useDatabase();
  const { show } = useSnackbar();
  return useCallback(
    async ({ id, title }) => {
      const snapshot = await booksRepo.removeBook(db, id);
      if (!snapshot) return false;
      announceChanges();
      const coverUri = snapshot.book.cover_uri as string | null;
      holdCover(coverUri);
      show({
        message: t('bookDetail.undoDelete.removed', { title }),
        duration: UNDO_WINDOW_MS,
        action: {
          label: t('common.undo'),
          onPress: () => {
            booksRepo
              .restoreBook(db, snapshot)
              .then(() => {
                announceChanges();
                show({ message: t('bookDetail.undoDelete.restored', { title }) });
              })
              .catch((e) => {
                console.error('Could not restore the book', e);
                show({ message: t('bookDetail.undoDelete.restoreFailed', { title }) });
              });
          },
        },
        onHide: (reason) => {
          // Undo puts the book back, naming its cover again; otherwise the file goes if nothing else names it.
          if (reason === 'action') unholdCover(coverUri);
          else void releaseCoverOfDeletedBook(db, coverUri);
        },
      });
      return true;
    },
    [db, show],
  );
}
