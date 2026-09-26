import type { ValidBookDraft } from '@/domain';

import { saveBookDraft } from './books';
import { findGenreByName } from './genres';

import type { Db } from '../types';

/**
 * Saves the result of "Refresh details" (P02-12): the book's fields as the
 * user accepted them, in one transaction. Unlike a form save, genres keep
 * their origin: the ones in `userGenres` stay marked as the user's choice,
 * every other genre is marked as looked up (`user_edited = 0`), so a later
 * refresh may replace it but never the user's own.
 */
export async function refreshBook(db: Db, id: number, value: ValidBookDraft, { userGenres }: { userGenres: readonly string[] }): Promise<void> {
  await db.transaction(async (tx) => {
    await saveBookDraft(tx, value, id);
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
