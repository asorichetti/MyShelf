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

function coverFile(bookId: number): File {
  return new File(coversDirectory(), `${bookId}.jpg`);
}

/**
 * Downloads a chosen cover to `<documentDirectory>/covers/<bookId>.jpg` and
 * returns its `file://` URI for `books.cover_uri`. Call only on a user action
 * (saving a book, "Refresh details"): covers are never prefetched.
 */
export async function downloadCover(bookId: number, url: string, { http, signal }: DownloadCoverOptions): Promise<string> {
  const { bytes } = await http.getBinary(url, { signal });
  if (!bytes.length) throw new Error(`Empty cover image from ${url}`);
  coversDirectory().create({ intermediates: true, idempotent: true });
  const file = coverFile(bookId);
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}

/** Deletes a book's downloaded cover. Returns whether a file was removed. */
export function deleteCover(bookId: number): boolean {
  const file = coverFile(bookId);
  if (!file.exists) return false;
  file.delete();
  return true;
}

/** Whether `uri` is already a book's stored cover (so saving the book need not copy it). */
export function isStoredCover(bookId: number, uri: string | null | undefined): boolean {
  return !!uri && uri === coverFile(bookId).uri;
}

/**
 * Copies a picked or photographed image (a temporary `file://` from the
 * picker) to `<documentDirectory>/covers/<bookId>.jpg`, replacing any old
 * cover, and returns its URI for `books.cover_uri`.
 */
export function storeCoverFile(bookId: number, sourceUri: string): string {
  coversDirectory().create({ intermediates: true, idempotent: true });
  const target = coverFile(bookId);
  if (target.exists) target.delete();
  new File(sourceUri).copy(target);
  return target.uri;
}
