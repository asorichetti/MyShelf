import { useSyncExternalStore } from 'react';

import { booksRepo, type Db } from '@/db';
import type { OcrFrame } from '@/domain';
import { emit } from '@/features/events';
import { storeCoverFile } from '@/services/covers';
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
 * becomes the book's cover (`covers/<bookId>.jpg`, like a picked photo),
 * then the photo and the copy are deleted. Resolves with the stored cover's URI.
 */
export async function acceptCoverPhoto(db: Db, bookId: number): Promise<string> {
  const offer = offers.get(bookId);
  if (!offer) throw new Error(`No cover photo on offer for book ${bookId}`);
  const { uri, focus } = offer;
  const prepared = await coverFromPhoto(uri, focus);
  try {
    const coverUri = storeCoverFile(bookId, prepared);
    await booksRepo.updateBook(db, bookId, { coverUri });
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
