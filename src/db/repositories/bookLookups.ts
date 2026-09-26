import { briefSummary, isLanguageCode, isValidIsbn10, isValidIsbn13, isbn10To13, isbn13To10, normaliseGenres, type CandidateLike, type NewBook, type ValidBookDraft } from '@/domain';

import { findOrCreateAuthor, setBookAuthors } from './authors';
import { createBook, saveBookDraft } from './books';
import { findGenreByName, findOrCreateGenre, setBookGenres } from './genres';

import type { Db } from '../types';

/**
 * Saves the result of "Refresh details" (P02-12): the book's fields as the
 * user accepted them, in one transaction. Unlike a form save, genres keep
 * their origin: the ones in `userGenres` stay marked as the user's choice,
 * every other genre is marked as looked up (`user_edited = 0`), so a later
 * refresh may replace it but never the user's own. The rating is not
 * written at all.
 */
export async function refreshBook(db: Db, id: number, value: ValidBookDraft, { userGenres }: { userGenres: readonly string[] }): Promise<void> {
  await db.transaction(async (tx) => {
    // The rating is the reader's own opinion: a refresh never writes it, whatever the draft holds.
    await saveBookDraft(tx, { ...value, rating: undefined }, id);
    const mine: number[] = [];
    for (const name of userGenres) {
      const genre = await findGenreByName(tx, name);
      if (genre) mine.push(genre.id);
    }
    await tx.run(
      `UPDATE book_genres SET user_edited = 0 WHERE book_id = ?${mine.length ? ` AND genre_id NOT IN (${mine.map(() => '?').join(', ')})` : ''}`,
      [id, ...mine],
    );
  });
}

/** Book fields the user may set before a candidate is saved (the scan flow's "notes", a chosen cover). */
export type CandidateOverrides = Partial<Pick<NewBook, 'notes' | 'coverUri' | 'title'>>;

/**
 * Saves a lookup candidate as a new book in one transaction (P03-09): the
 * book row with its `source`/`source_id`, its authors (reusing existing ones
 * by name) and its genres from the normaliser, marked as looked up
 * (`user_edited = 0`). The series and the cover are the caller's next steps
 * (`applyDetectedSeries`, `attachCoverFromCandidate`): they may confirm with
 * the user or reach the network, and neither may undo the saved book.
 * Returns the new book's id.
 */
export async function createBookFromCandidate(db: Db, candidate: CandidateLike, overrides: CandidateOverrides = {}): Promise<number> {
  const isbn13 = candidate.isbn13 && isValidIsbn13(candidate.isbn13) ? candidate.isbn13 : candidate.isbn10 && isValidIsbn10(candidate.isbn10) ? isbn10To13(candidate.isbn10) : null;
  const isbn10 = candidate.isbn10 && isValidIsbn10(candidate.isbn10) ? candidate.isbn10 : isbn13 ? isbn13To10(isbn13) : null;
  return db.transaction(async (tx) => {
    const book = await createBook(tx, {
      title: (overrides.title ?? candidate.title).trim(),
      subtitle: candidate.subtitle?.trim() || null,
      isbn13,
      isbn10,
      edition: candidate.edition?.trim() || null,
      publisher: candidate.publisher?.trim() || null,
      publicationYear: candidate.publicationYear,
      pageCount: candidate.pageCount != null && candidate.pageCount > 0 ? candidate.pageCount : null,
      summary: briefSummary(candidate.summary),
      language: candidate.language && isLanguageCode(candidate.language) ? candidate.language : null,
      format: candidate.format,
      source: candidate.source,
      sourceId: candidate.sourceId,
      notes: overrides.notes?.trim() || null,
      coverUri: overrides.coverUri ?? null,
    });
    const links = [];
    const seen = new Set<string>();
    for (const name of candidate.authors.map((a) => a.trim()).filter(Boolean)) {
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      links.push({ authorId: (await findOrCreateAuthor(tx, name)).id, role: 'author' as const });
    }
    await setBookAuthors(tx, book.id, links);
    const genreIds = [];
    for (const name of normaliseGenres(candidate.subjects)) genreIds.push((await findOrCreateGenre(tx, name)).id);
    await setBookGenres(tx, book.id, genreIds, { userEdited: false });
    return book.id;
  });
}
