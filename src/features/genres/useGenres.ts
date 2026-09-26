import { useCallback, useEffect, useState } from 'react';

import { genresRepo, useDatabase, type GenreWithCount } from '@/db';
import { emit, useLibraryEvent } from '@/features/events';

export interface GenresState {
  /** Every genre A-Z with its book count; null until loaded. */
  genres: GenreWithCount[] | null;
  /** Renames a genre; throws GenreNameTakenError when another genre has that name. */
  rename: (id: number, name: string) => Promise<void>;
  /** Moves every book from `sourceId` into `targetId` and deletes the source. */
  merge: (sourceId: number, targetId: number) => Promise<GenreWithCount | null>;
  /** Deletes a genre; its books only lose the tag. */
  remove: (id: number) => Promise<void>;
}

/** The genre index: loads on mount and reloads on `library-changed`, which every write here emits. */
export function useGenres(): GenresState {
  const db = useDatabase();
  const [genres, setGenres] = useState<GenreWithCount[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    genresRepo
      .listGenresWithCounts(db)
      .then((list) => active && setGenres(list))
      .catch((e) => console.error('Could not load the genres', e));
    return () => {
      active = false;
    };
  }, [db, version]);

  useLibraryEvent('library-changed', () => setVersion((v) => v + 1));

  const rename = useCallback(
    async (id: number, name: string) => {
      await genresRepo.renameGenre(db, id, name);
      emit('library-changed');
    },
    [db],
  );
  const merge = useCallback(
    async (sourceId: number, targetId: number) => {
      const merged = await genresRepo.mergeGenres(db, sourceId, targetId);
      emit('library-changed');
      return merged;
    },
    [db],
  );
  const remove = useCallback(
    async (id: number) => {
      await genresRepo.deleteGenre(db, id);
      emit('library-changed');
    },
    [db],
  );

  return { genres, rename, merge, remove };
}
