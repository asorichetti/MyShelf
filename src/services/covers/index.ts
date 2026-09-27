export { deleteAllCovers, deleteCoverFile, downloadCover, isStoredCover, storeCoverFile, type DownloadCoverOptions } from './downloadCover';
export {
  COVER_BATCH_SIZE,
  coverBatchUrl,
  coverSourcesFromBatch,
  findCoverIdsByIsbn,
  searchIsbn13,
  type CoverBatchResponse,
  type FindCoverIdsOptions,
} from './batchCoverIds';
export { combineCoverSources, coverSourceFromBook, coverSourceFromCandidate } from './coverSource';
export {
  coverCandidates,
  googleCoverUrlForVolume,
  olCoverByIdUrl,
  olCoverByKeyUrl,
  upgradeGoogleCoverUrl,
  type CoverCandidate,
  type CoverOrigin,
  type CoverSource,
} from './coverUrls';
export { GOOGLE_COVERS_REACHABLE } from './googleCovers';
export { readImageSize, type ImageSize } from './imageSize';
export { resolveCover, type CoverResolution, type CoverTrial, type ResolveCoverOptions, type ResolvedCover } from './resolveCover';
export { compareCovers, coverShape, isGoodCover, validateCover, type CoverCheck, type CoverRejection, type CoverShape } from './validateCover';

/** True for a cover stored on the device (as opposed to a remote URL). */
export function isLocalCover(uri: string | null | undefined): boolean {
  return !!uri && uri.startsWith('file:');
}
