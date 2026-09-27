import { useState } from 'react';

import { UsePhotoAsCover } from '@/components/scan/UsePhotoAsCover';
import { useSnackbar } from '@/components/ui';
import { useDatabase } from '@/db';
import { t } from '@/i18n';

import { acceptCoverPhoto, declineCoverPhoto, useCoverPhotoOffer } from './coverPhotoOffer';

/**
 * On a book's page: Booky's offer to use the cover photo as the cover, when
 * the book was found from one and no online cover exists (P03-14). Nothing
 * otherwise.
 */
export function CoverPhotoOfferHost({ bookId, title }: { bookId: number; title: string }) {
  const photoUri = useCoverPhotoOffer(bookId);
  const db = useDatabase();
  const { show } = useSnackbar();
  const [busy, setBusy] = useState(false);
  if (!photoUri) return null;

  const use = async () => {
    setBusy(true);
    try {
      await acceptCoverPhoto(db, bookId);
      show({ message: t('scan.coverPhoto.saved') });
    } catch (e) {
      console.error('Could not use the photo as the cover', e);
      declineCoverPhoto(bookId);
      show({ message: t('scan.coverPhoto.failed') });
    } finally {
      setBusy(false);
    }
  };

  return <UsePhotoAsCover photoUri={photoUri} title={title} busy={busy} onUse={() => void use()} onDecline={() => declineCoverPhoto(bookId)} />;
}
