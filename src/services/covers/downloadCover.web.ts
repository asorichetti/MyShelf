import type { HttpClient } from '@/services/http';

export interface DownloadCoverOptions {
  http: Pick<HttpClient, 'getBinary'>;
  signal?: AbortSignal;
}

/** The web build keeps the remote cover URL: there is no app document directory to fill. */
export async function downloadCover(_bookId: number, url: string, _options: DownloadCoverOptions): Promise<string> {
  return url;
}

/** The web build stores no cover files. */
export function deleteCoverFile(_uri: string | null | undefined): boolean {
  return false;
}

/** The web build stores no cover files. */
export function deleteAllCovers(): number {
  return 0;
}

/** The web build keeps covers as they are (a URL or a data: URI): each is already "stored". */
export function isStoredCover(_uri: string | null | undefined): boolean {
  return true;
}

/** The web build keeps the picked image's own URI (a data: URI from the file picker). */
export function storeCoverFile(sourceUri: string, _options: { bookId?: number } = {}): string {
  return sourceUri;
}
