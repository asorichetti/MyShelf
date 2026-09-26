import { useCallback } from 'react';

import { booksRepo, useDatabase, type Db } from '@/db';
import { bookMatchKey, normalizeIsbn, type BookDetail, type CandidateLike } from '@/domain';

/**
 * Books already on the shelf that a candidate would duplicate (P03-10): the
 * same ISBN (13 or 10), or — for a candidate without one — the same title
 * and first author (ignoring case, accents and a leading article).
 */
export async function findDuplicates(db: Db, candidate: Pick<CandidateLike, 'isbn13' | 'isbn10' | 'title' | 'authors'>): Promise<BookDetail[]> {
  const isbns = [candidate.isbn13, candidate.isbn10].map((i) => normalizeIsbn(i)).filter((i): i is string => Boolean(i));
  const ids = new Set<number>();
  for (const isbn of isbns) for (const b of await booksRepo.findBooksByIsbn(db, isbn)) ids.add(b.id);
  if (!isbns.length) {
    const key = bookMatchKey(candidate.title, candidate.authors[0]);
    for (const b of await booksRepo.searchBooks(db, candidate.title)) {
      const detail = await booksRepo.getBookDetail(db, b.id);
      if (detail && bookMatchKey(detail.title, detail.authors[0]?.name) === key) ids.add(b.id);
    }
  }
  const out: BookDetail[] = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const detail = await booksRepo.getBookDetail(db, id);
    if (detail) out.push(detail);
  }
  return out;
}

/** `check(candidate)`: the copies already on the shelf (empty when it is new). */
export function useDuplicateCheck(): { check: (candidate: Pick<CandidateLike, 'isbn13' | 'isbn10' | 'title' | 'authors'>) => Promise<BookDetail[]> } {
  const db = useDatabase();
  const check = useCallback((candidate: Parameters<typeof findDuplicates>[1]) => findDuplicates(db, candidate), [db]);
  return { check };
}
