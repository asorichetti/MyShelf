import type { Book } from '@/domain';
import type { BookCandidate } from '@/services/metadata';

import type { CoverSource } from './coverUrls';

/** Everything a (merged) lookup candidate knows about its cover. */
export function coverSourceFromCandidate(candidate: BookCandidate): CoverSource {
  const refs = candidate.coverRefs;
  return {
    isbn13: candidate.isbn13,
    isbn10: candidate.isbn10,
    olEditionCoverIds: refs.olEditionCoverIds,
    olEditionId: candidate.source === 'openlibrary' && candidate.kind === 'edition' ? candidate.sourceId : null,
    olWorkCoverIds: refs.olWorkCoverIds,
    olOtherEditionCoverIds: refs.olOtherEditionCoverIds ?? [],
    googleVolumeId: refs.googleVolumeId,
    googleImageUrl: refs.googleImageUrl,
  };
}

/** What a stored book offers: its ISBNs and the provider record it was saved from. */
export function coverSourceFromBook(book: Pick<Book, 'isbn13' | 'isbn10' | 'source' | 'sourceId'>): CoverSource {
  return {
    isbn13: book.isbn13,
    isbn10: book.isbn10,
    olEditionId: book.source === 'openlibrary' ? book.sourceId : null,
    googleVolumeId: book.source === 'googlebooks' ? book.sourceId : null,
  };
}

/** Both sources in one; the first one's fields win where both have them. */
export function combineCoverSources(first: CoverSource, second: CoverSource): CoverSource {
  const pick = <K extends keyof CoverSource>(key: K): CoverSource[K] => {
    const a = first[key];
    return (Array.isArray(a) ? a.length > 0 : a != null) ? a : second[key];
  };
  return {
    isbn13: pick('isbn13'),
    isbn10: pick('isbn10'),
    olEditionCoverIds: pick('olEditionCoverIds'),
    olEditionId: pick('olEditionId'),
    olWorkCoverIds: pick('olWorkCoverIds'),
    olOtherEditionCoverIds: pick('olOtherEditionCoverIds'),
    googleVolumeId: pick('googleVolumeId'),
    googleImageUrl: pick('googleImageUrl'),
  };
}
