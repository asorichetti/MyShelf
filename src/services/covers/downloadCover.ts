import { Directory, File, Paths } from 'expo-file-system';

import type { HttpClient } from '@/services/http';

export interface DownloadCoverOptions {
  /** The app's HTTP client, so cover requests follow the same etiquette as metadata. */
  http: Pick<HttpClient, 'getBinary'>;
  signal?: AbortSignal;
}

function coversDirectory(): Directory {
  return new Directory(Paths.document, 'covers');
}

/**
 * A new file in the covers folder, never used before: `<bookId>-<unique>.jpg`
 * (`book-<unique>.jpg` for a book not saved yet). Every stored cover has a
 * name of its own, so replacing a cover, restoring a backup or putting a
 * book back under another id never writes over a file something else still
 * names (the backup's safety copy, a deleted book waiting for Undo). Covers
 * stored before this, `covers/<id>.jpg`, stay valid until replaced.
 */
function newCoverFile(bookId?: number): File {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return new File(coversDirectory(), `${bookId ?? 'book'}-${unique}.jpg`);
}

/** Whether `uri` names a file in the covers folder (any name, old or new). */
export function isStoredCover(uri: string | null | undefined): boolean {
  return !!uri && uri.startsWith(`${coversDirectory().uri.replace(/\/$/, '')}/`);
}

/**
 * Downloads a chosen cover into a new file in `<documentDirectory>/covers`
 * and returns its `file://` URI for `books.cover_uri`. Call only on a user
 * action (saving a book, "Refresh details") or from the backfill: covers are
 * never prefetched. The caller sets it on the book, then releases the old
 * cover (`releaseCover`), and deletes this file if the book cannot take it.
 */
export async function downloadCover(bookId: number, url: string, { http, signal }: DownloadCoverOptions): Promise<string> {
  const { bytes } = await http.getBinary(url, { signal });
  if (!bytes.length) throw new Error(`Empty cover image from ${url}`);
  coversDirectory().create({ intermediates: true, idempotent: true });
  const file = newCoverFile(bookId);
  file.create({ overwrite: true });
  try {
    file.write(bytes);
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
  return file.uri;
}

/** Deletes a stored cover file; anything outside the covers folder is left alone. Returns whether a file was removed. */
export function deleteCoverFile(uri: string | null | undefined): boolean {
  if (!isStoredCover(uri)) return false;
  const file = new File(uri!);
  if (!file.exists) return false;
  file.delete();
  return true;
}

/** Deletes every downloaded or picked cover ("Erase library"). Returns how many files went. */
export function deleteAllCovers(): number {
  const dir = coversDirectory();
  if (!dir.exists) return 0;
  const count = dir.list().length;
  dir.delete();
  return count;
}

/**
 * Copies a picked or photographed image (a temporary `file://` from the
 * picker) into a new file in `<documentDirectory>/covers` and returns its URI
 * for `books.cover_uri`. Nothing is deleted: a copy that fails leaves the
 * book's current cover as it was (and no half-written file), and the old
 * cover is released by the caller once the book names the new one.
 */
export function storeCoverFile(sourceUri: string, { bookId }: { bookId?: number } = {}): string {
  coversDirectory().create({ intermediates: true, idempotent: true });
  const target = newCoverFile(bookId);
  try {
    new File(sourceUri).copy(target);
  } catch (error) {
    if (target.exists) target.delete();
    throw error;
  }
  return target.uri;
}
