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
