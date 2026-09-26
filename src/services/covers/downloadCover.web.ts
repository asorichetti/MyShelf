import type { HttpClient } from '@/services/http';

export interface DownloadCoverOptions {
  http: Pick<HttpClient, 'getBinary'>;
  signal?: AbortSignal;
}

/** The web build keeps the remote cover URL: there is no app document directory to fill. */
export async function downloadCover(_bookId: number, url: string, _options: DownloadCoverOptions): Promise<string> {
  return url;
}

export function deleteCover(_bookId: number): boolean {
  return false;
}

/** The web build stores no cover files. */
export function deleteAllCovers(): number {
  return 0;
}

export function isStoredCover(_bookId: number, _uri: string | null | undefined): boolean {
  return true;
}

/** The web build keeps the picked image's own URI (a data: URI from the file picker). */
export function storeCoverFile(_bookId: number, sourceUri: string): string {
  return sourceUri;
}
