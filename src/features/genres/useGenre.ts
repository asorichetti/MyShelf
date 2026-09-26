import { useEffect, useState } from 'react';

import { booksRepo, genresRepo, useDatabase } from '@/db';
import type { BookListItem, Genre } from '@/domain';
import { useLibraryEvent } from '@/features/events';

export type GenreState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; genre: Genre; items: BookListItem[] };

/** One genre and its books A-Z; reloads when the library or loans change. */
export function useGenre(id: number | null): GenreState {
  const db = useDatabase();
  const [state, setState] = useState<GenreState>(id == null ? { status: 'missing' } : { status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (id == null) return;
    let active = true;
    Promise.all([genresRepo.getGenre(db, id), booksRepo.listBookItems(db, { scope: { genreId: id } })])
      .then(([genre, items]) => active && setState(genre ? { status: 'ready', genre, items } : { status: 'missing' }))
      .catch((e) => {
        console.error('Could not load the genre', e);
        if (active) setState({ status: 'missing' });
      });
    return () => {
      active = false;
    };
  }, [db, id, version]);

  useLibraryEvent(['library-changed', 'loans-changed'], () => setVersion((v) => v + 1));
  return id == null ? { status: 'missing' } : state;
}
