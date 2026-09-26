import { useCallback, useEffect, useState } from 'react';

import { authorsRepo, booksRepo, useDatabase } from '@/db';
import type { Author, BookListItem } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';
import { t } from '@/i18n';

/** A run of an author's books: one series (in reading order) or their standalones (by year). */
export interface AuthorShelf {
  key: string;
  seriesId: number | null;
  title: string;
  items: BookListItem[];
}

export type AuthorState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; author: Author; shelves: AuthorShelf[]; count: number };

/**
 * Splits an author's books (already sorted by year) into their series, A-Z,
 * each in reading order, then the standalone books by year.
 */
export function shelvesFor(items: BookListItem[]): AuthorShelf[] {
  const series = new Map<number, AuthorShelf>();
  const standalone: BookListItem[] = [];
  for (const item of items) {
    if (item.seriesId == null) {
      standalone.push(item);
      continue;
    }
    let shelf = series.get(item.seriesId);
    if (!shelf) {
      shelf = { key: `series:${item.seriesId}`, seriesId: item.seriesId, title: item.seriesName ?? t('authors.shelves.series'), items: [] };
      series.set(item.seriesId, shelf);
    }
    shelf.items.push(item);
  }
  const byPosition = (a: BookListItem, b: BookListItem) => (a.seriesPosition ?? Infinity) - (b.seriesPosition ?? Infinity);
  const out = [...series.values()]
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    .map((s) => ({ ...s, items: [...s.items].sort(byPosition) }));
  if (standalone.length) out.push({ key: 'standalone', seriesId: null, title: t(out.length ? 'authors.shelves.standalone' : 'authors.shelves.books'), items: standalone });
  return out;
}

export interface AuthorDetail {
  state: AuthorState;
  update: (patch: { name: string; sortName: string | null }) => Promise<void>;
  /** Merges this author into `targetId` (this one goes away); resolves to the kept author. */
  mergeInto: (targetId: number) => Promise<Author | null>;
}

/** One author with their books grouped by series then standalone; reloads on `library-changed`. */
export function useAuthor(id: number | null): AuthorDetail {
  const db = useDatabase();
  const [state, setState] = useState<AuthorState>(id == null ? { status: 'missing' } : { status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (id == null) return;
    let active = true;
    Promise.all([authorsRepo.getAuthor(db, id), booksRepo.listBookItems(db, { scope: { authorId: id }, sort: { levels: [{ key: 'year', direction: 'asc' }] } })])
      .then(([author, items]) => {
        if (!active) return;
        setState(author ? { status: 'ready', author, shelves: shelvesFor(items), count: items.length } : { status: 'missing' });
      })
      .catch((e) => {
        console.error('Could not load the author', e);
        if (active) setState({ status: 'missing' });
      });
    return () => {
      active = false;
    };
  }, [db, id, version]);

  useLibraryEvent(['library-changed', 'loans-changed'], () => setVersion((v) => v + 1));

  const update = useCallback(
    async (patch: { name: string; sortName: string | null }) => {
      if (id == null) return;
      await authorsRepo.updateAuthor(db, id, patch);
      emit('library-changed');
    },
    [db, id],
  );
  const mergeInto = useCallback(
    async (targetId: number) => {
      if (id == null) return null;
      const kept = await authorsRepo.mergeAuthors(db, id, targetId);
      emit('library-changed');
      return kept;
    },
    [db, id],
  );

  return { state: id == null ? { status: 'missing' } : state, update, mergeInto };
}
