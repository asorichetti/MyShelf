import { useSyncExternalStore } from 'react';

import { booksRepo, type Db } from '@/db';
import type { OcrFrame } from '@/domain';
import { releaseCover } from '@/features/covers';
import { emit } from '@/features/events';
import { deleteCoverFile, storeCoverFile } from '@/services/covers';
import { coverFromPhoto } from '@/services/recognition';

import { discardPhoto } from './tempPhoto';

import type { SavedCandidate } from './useSaveCandidate';

/**
 * "Use my photo as the cover?" (P03-14). A book found by reading its cover
 * keeps the photo until its cover search finishes: when no online cover
 * exists, the photo is offered on the book's page; otherwise, or once the
 * offer is answered, it is deleted. Offers live in memory for the app session.
 */
const offers = new Map<number, { uri: string; focus: OcrFrame | null }>();
const listeners = new Set<() => void>();

function changed() {
  for (const l of [...listeners]) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Offers `photoUri` as the cover of `bookId`. */
export function offerCoverPhoto(bookId: number, photoUri: string, focus: OcrFrame | null = null): void {
  const old = offers.get(bookId)?.uri;
  if (old && old !== photoUri) discardPhoto(old);
  offers.set(bookId, { uri: photoUri, focus });
  changed();
}

/** The photo on offer for `bookId`, if any. */
export function coverPhotoOffer(bookId: number): string | null {
  return offers.get(bookId)?.uri ?? null;
}

/** The photo on offer for a book, kept up to date. */
export function useCoverPhotoOffer(bookId: number | null): string | null {
  return useSyncExternalStore(subscribe, () => (bookId == null ? null : coverPhotoOffer(bookId)));
}

/** "No thanks": forget the offer and delete the photo. */
export function declineCoverPhoto(bookId: number): void {
  const uri = offers.get(bookId)?.uri;
  offers.delete(bookId);
  discardPhoto(uri);
  changed();
}

/**
 * "Use my photo": an upright 2:3 copy of the photo, cropped around its text,
 * becomes the book's cover (a file of its own in `covers/`, like a picked
 * photo), then the photo and the copy are deleted, and any cover the book
 * had meanwhile is released. Resolves with the stored cover's URI.
 */
export function acceptCoverPhoto(db: Db, bookId: number): Promise<string> {
  // A second tap while the first is still making the cover waits for it.
  let accepting = inProgress.get(bookId);
  if (!accepting) {
    accepting = accept(db, bookId).finally(() => inProgress.delete(bookId));
    inProgress.set(bookId, accepting);
  }
  return accepting;
}

const inProgress = new Map<number, Promise<string>>();

async function accept(db: Db, bookId: number): Promise<string> {
  const offer = offers.get(bookId);
  if (!offer) throw new Error(`No cover photo on offer for book ${bookId}`);
  const { uri, focus } = offer;
  const prepared = await coverFromPhoto(uri, focus);
  try {
    const before = (await booksRepo.getBook(db, bookId))?.coverUri ?? null;
    const coverUri = storeCoverFile(prepared, { bookId });
    try {
      if (!(await booksRepo.updateBook(db, bookId, { coverUri }))) throw new Error(`No book ${bookId}`);
    } catch (error) {
      deleteCoverFile(coverUri);
      throw error;
    }
    if (before && before !== coverUri) void releaseCover(db, before);
    offers.delete(bookId);
    discardPhoto(uri);
    changed();
    emit('library-changed');
    return coverUri;
  } finally {
    if (prepared !== uri) discardPhoto(prepared);
  }
}

/**
 * After saving a book found from a cover photo: offer the photo when the
 * cover search finds no online cover, and delete it otherwise (a cover was
 * found, the phone is offline, or the search failed).
 */
export function offerPhotoIfNoCover(saved: Pick<SavedCandidate, 'id' | 'cover'>, photoUri: string | null, focus: OcrFrame | null = null): void {
  if (!photoUri) return;
  void saved.cover.then((result) => {
    if (result?.status === 'none') offerCoverPhoto(saved.id, photoUri, focus);
    else discardPhoto(photoUri);
  });
}

/** Tests: forget every offer (without deleting files). */
export function clearCoverPhotoOffers(): void {
  offers.clear();
  changed();
}
