import type { BookCandidate, CandidateSource, CoverRefs } from './types';

/** Cover refs with nothing known. */
export function emptyCoverRefs(): CoverRefs {
  return { olEditionCoverIds: [], olWorkCoverIds: [], googleVolumeId: null, googleImageUrl: null };
}

/** A candidate with every optional field empty; mappers and tests fill in what they know. */
export function makeCandidate(
  base: Pick<BookCandidate, 'title' | 'source' | 'sourceId'> & Partial<BookCandidate>,
): BookCandidate {
  return {
    kind: 'edition',
    subtitle: null,
    authors: [],
    publisher: null,
    publicationYear: null,
    pageCount: null,
    isbn13: null,
    isbn10: null,
    edition: null,
    language: null,
    format: null,
    summary: null,
    coverUrl: null,
    coverRefs: emptyCoverRefs(),
    subjects: [],
    seriesHints: [],
    workKey: null,
    editionCount: null,
    confidence: 0.5,
    ...base,
  };
}

export type { BookCandidate, CandidateSource, CoverRefs };
