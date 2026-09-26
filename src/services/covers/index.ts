export { deleteCover, downloadCover, type DownloadCoverOptions } from './downloadCover';

/** True for a cover stored on the device (as opposed to a remote URL). */
export function isLocalCover(uri: string | null | undefined): boolean {
  return !!uri && uri.startsWith('file:');
}
