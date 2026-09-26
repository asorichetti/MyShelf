import { useCallback, useEffect, useState } from 'react';

import { booksRepo, groupsRepo, useDatabase } from '@/db';
import { moveItem, type BookListItem, type Group } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';

export type GroupState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; group: Group; items: BookListItem[] };

export interface GroupDetail {
  state: GroupState;
  /** Moves the book at `from` to `to` and saves the new order. */
  move: (from: number, to: number) => Promise<void>;
  /** Takes books out of the group (they stay on the shelf). */
  removeBooks: (bookIds: readonly number[]) => Promise<number>;
  reload: () => void;
}

/**
 * One group and its books in the group's own order. Moving a book updates
 * the list at once and saves the whole order in one transaction; the list
 * reloads on `groups-changed` and `library-changed`.
 */
export function useGroup(id: number | null): GroupDetail {
  const db = useDatabase();
  const [state, setState] = useState<GroupState>(id == null ? { status: 'missing' } : { status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (id == null) return;
    let active = true;
    Promise.all([groupsRepo.getGroup(db, id), booksRepo.listBookItems(db, { scope: { groupId: id }, groupOrder: true })])
      .then(([group, items]) => active && setState(group ? { status: 'ready', group, items } : { status: 'missing' }))
      .catch((e) => {
        console.error('Could not load the group', e);
        if (active) setState({ status: 'missing' });
      });
    return () => {
      active = false;
    };
  }, [db, id, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useLibraryEvent(['groups-changed', 'library-changed', 'loans-changed'], reload);

  const move = useCallback(
    async (from: number, to: number) => {
      if (state.status !== 'ready') return;
      const items = moveItem(state.items, from, to);
      setState({ ...state, items });
      try {
        await groupsRepo.reorderGroup(db, state.group.id, items.map((i) => i.id));
        emit('groups-changed');
      } catch (e) {
        console.error('Could not save the new order', e);
        reload();
      }
    },
    [db, state, reload],
  );

  const removeBooks = useCallback(
    async (bookIds: readonly number[]) => {
      if (state.status !== 'ready') return 0;
      const removed = await groupsRepo.removeBooksFromGroup(db, state.group.id, bookIds);
      emit('groups-changed');
      return removed;
    },
    [db, state],
  );

  return { state: id == null ? { status: 'missing' } : state, move, removeBooks, reload };
}
