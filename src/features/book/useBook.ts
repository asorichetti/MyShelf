import { useCallback, useEffect, useState } from 'react';

import { booksRepo, useDatabase } from '@/db';
import type { BookDetail } from '@/domain';
import { useLibraryEvent } from '@/features/events';

export type BookState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; book: BookDetail };

/** Parses a route's `id` param; null when it is not a positive whole number. */
export function parseBookId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
}

/** One book with everything its detail page shows; reloads when the library or its loans change. */
export function useBook(id: number | null): BookState & { reload: () => void } {
  const db = useDatabase();
  const [state, setState] = useState<BookState>(id == null ? { status: 'missing' } : { status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (id == null) return;
    let active = true;
    booksRepo
      .getBookDetail(db, id)
      .then((book) => active && setState(book ? { status: 'ready', book } : { status: 'missing' }))
      .catch((e) => {
        console.error('Could not load the book', e);
        if (active) setState({ status: 'missing' });
      });
    return () => {
      active = false;
    };
  }, [db, id, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useLibraryEvent(['library-changed', 'loans-changed'], reload);
  return { ...(id == null ? { status: 'missing' as const } : state), reload };
}
