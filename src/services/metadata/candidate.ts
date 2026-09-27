import { AUTHOR_NAME_MAX, clampText, TITLE_MAX } from '@/domain';

import type { BookCandidate, CoverRefs } from './types';

/** Cover refs with nothing known. */
export function emptyCoverRefs(): CoverRefs {
  return { olEditionCoverIds: [], olWorkCoverIds: [], googleVolumeId: null, googleImageUrl: null };
}

/**
 * A candidate with every optional field empty; mappers and tests fill in what
 * they know. A title or author name past what the book form takes (broken
 * provider data) is shortened at a word with an ellipsis (`clampText`).
 */
export function makeCandidate(
  base: Pick<BookCandidate, 'title' | 'source' | 'sourceId'> & Partial<BookCandidate>,
): BookCandidate {
  const candidate: BookCandidate = {
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
  candidate.title = clampText(candidate.title, TITLE_MAX);
  candidate.authors = candidate.authors.map((a) => clampText(a, AUTHOR_NAME_MAX));
  return candidate;
}

export type { BookCandidate, CoverRefs };
