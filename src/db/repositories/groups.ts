import type { Book, BookGroup, Group, NewGroup } from '@/domain';

import { BOOK_COLUMNS, foldBookGroups, toBook, type BookRow } from './shared';

import type { Db } from '../types';

interface GroupRow {
  id: number;
  name: string;
  colour: string | null;
  icon: string | null;
  created_at: string;
}

const toGroup = (r: GroupRow): Group => ({ id: r.id, name: r.name, colour: r.colour, icon: r.icon, createdAt: r.created_at });

export async function createGroup(db: Db, input: NewGroup): Promise<Group> {
  const { lastInsertRowId } = await db.run('INSERT INTO groups (name, colour, icon) VALUES (?, ?, ?)', [
    input.name.trim(),
    input.colour ?? null,
    input.icon ?? null,
  ]);
  return (await getGroup(db, lastInsertRowId))!;
}

export async function getGroup(db: Db, id: number): Promise<Group | null> {
  const row = await db.get<GroupRow>('SELECT id, name, colour, icon, created_at FROM groups WHERE id = ?', [id]);
  return row ? toGroup(row) : null;
}

export async function listGroups(db: Db): Promise<Group[]> {
  const rows = await db.all<GroupRow>('SELECT id, name, colour, icon, created_at FROM groups ORDER BY name COLLATE NOCASE, id');
  return rows.map(toGroup);
}

export async function updateGroup(db: Db, id: number, patch: Partial<NewGroup>): Promise<Group | null> {
  const current = await getGroup(db, id);
  if (!current) return null;
  const next = { ...current, ...patch, name: patch.name?.trim() ?? current.name };
  await db.run('UPDATE groups SET name = ?, colour = ?, icon = ? WHERE id = ?', [next.name, next.colour ?? null, next.icon ?? null, id]);
  return next;
}

/** Deletes a group; its books are untouched. */
export async function deleteGroup(db: Db, id: number): Promise<boolean> {
  return (await db.run('DELETE FROM groups WHERE id = ?', [id])).changes > 0;
}

/** Adds a book to a group (at the end unless a position is given). Adding twice updates the position. */
export async function addBookToGroup(db: Db, groupId: number, bookId: number, position?: number): Promise<void> {
  const pos = position ?? null;
  await db.run(
    `INSERT INTO group_books (group_id, book_id, position)
     VALUES (?, ?, COALESCE(?, (SELECT COALESCE(MAX(position), -1) + 1 FROM group_books WHERE group_id = ?)))
     ON CONFLICT (group_id, book_id) DO UPDATE SET position = CASE WHEN ? IS NULL THEN position ELSE excluded.position END`,
    [groupId, bookId, pos, groupId, pos],
  );
}

/** Member book ids in the group's order. */
export async function listGroupBookIds(db: Db, groupId: number): Promise<number[]> {
  const rows = await db.all<{ book_id: number }>('SELECT book_id FROM group_books WHERE group_id = ? ORDER BY position, book_id', [groupId]);
  return rows.map((r) => r.book_id);
}

/** Writes positions 0..n-1 in the given order. */
async function writePositions(db: Db, groupId: number, bookIds: number[]): Promise<void> {
  for (const [position, bookId] of bookIds.entries()) {
    await db.run('UPDATE group_books SET position = ? WHERE group_id = ? AND book_id = ? AND position != ?', [position, groupId, bookId, position]);
  }
}

/**
 * Adds books to the end of a group, in the order given, in one transaction.
 * Books already in the group (or listed twice) stay where they are. Returns
 * how many were added.
 */
export async function addBooksToGroup(db: Db, groupId: number, bookIds: readonly number[]): Promise<number> {
  return db.transaction(async (tx) => {
    const members = new Set(await listGroupBookIds(tx, groupId));
    let next = members.size ? ((await tx.get<{ max: number }>('SELECT MAX(position) AS max FROM group_books WHERE group_id = ?', [groupId]))?.max ?? -1) + 1 : 0;
    let added = 0;
    for (const bookId of bookIds) {
      if (members.has(bookId)) continue;
      await tx.run('INSERT INTO group_books (group_id, book_id, position) VALUES (?, ?, ?)', [groupId, bookId, next++]);
      members.add(bookId);
      added++;
    }
    return added;
  });
}

/** Takes books out of a group (the books themselves stay); positions close up. Returns how many were removed. */
export async function removeBooksFromGroup(db: Db, groupId: number, bookIds: readonly number[]): Promise<number> {
  return db.transaction(async (tx) => {
    let removed = 0;
    for (const bookId of new Set(bookIds)) {
      removed += (await tx.run('DELETE FROM group_books WHERE group_id = ? AND book_id = ?', [groupId, bookId])).changes;
    }
    if (removed) await writePositions(tx, groupId, await listGroupBookIds(tx, groupId));
    return removed;
  });
}

export async function removeBookFromGroup(db: Db, groupId: number, bookId: number): Promise<boolean> {
  return (await removeBooksFromGroup(db, groupId, [bookId])) > 0;
}

/**
 * Puts a group's books in the given order (positions 0..n-1). Ids that are
 * not members are ignored; members missing from the list keep their relative
 * order after the listed ones. Returns the new order.
 */
export async function reorderGroup(db: Db, groupId: number, orderedBookIds: readonly number[]): Promise<number[]> {
  return db.transaction(async (tx) => {
    const current = await listGroupBookIds(tx, groupId);
    const members = new Set(current);
    const listed = [...new Set(orderedBookIds)].filter((id) => members.has(id));
    const seen = new Set(listed);
    const order = [...listed, ...current.filter((id) => !seen.has(id))];
    await writePositions(tx, groupId, order);
    return order;
  });
}

/** A group with what its card shows. */
export interface GroupSummary extends Group {
  count: number;
  /** The first three books (in the group's order) for the cover collage. */
  covers: { id: number; title: string; coverUri: string | null }[];
}

/** Every group A-Z with its book count and first three covers, in two queries. */
export async function listGroupsWithStats(db: Db): Promise<GroupSummary[]> {
  const groups = await db.all<GroupRow & { count: number }>(
    `SELECT g.id, g.name, g.colour, g.icon, g.created_at, COUNT(gb.book_id) AS count
     FROM groups g LEFT JOIN group_books gb ON gb.group_id = g.id
     GROUP BY g.id ORDER BY g.name COLLATE NOCASE, g.id`,
  );
  const covers = await db.all<{ group_id: number; id: number; title: string; cover_uri: string | null }>(
    `SELECT group_id, id, title, cover_uri FROM (
       SELECT gb.group_id, b.id, b.title, b.cover_uri,
         ROW_NUMBER() OVER (PARTITION BY gb.group_id ORDER BY gb.position, b.id) AS n
       FROM group_books gb JOIN books b ON b.id = gb.book_id)
     WHERE n <= 3 ORDER BY group_id, n`,
  );
  const byGroup = new Map<number, GroupSummary['covers']>();
  for (const c of covers) {
    const list = byGroup.get(c.group_id) ?? [];
    list.push({ id: c.id, title: c.title, coverUri: c.cover_uri });
    byGroup.set(c.group_id, list);
  }
  return groups.map((g) => ({ ...toGroup(g), count: g.count, covers: byGroup.get(g.id) ?? [] }));
}

export async function listBooksInGroup(db: Db, groupId: number): Promise<Book[]> {
  const rows = await db.all<BookRow>(
    `SELECT ${BOOK_COLUMNS} FROM group_books gb JOIN books b ON b.id = gb.book_id
     WHERE gb.group_id = ? ORDER BY gb.position, b.title COLLATE NOCASE, b.id`,
    [groupId],
  );
  return rows.map(toBook);
}

/** The groups a book is in, A-Z. */
export async function listGroupsForBook(db: Db, bookId: number): Promise<Group[]> {
  const rows = await db.all<GroupRow>(
    `SELECT g.id, g.name, g.colour, g.icon, g.created_at FROM group_books gb JOIN groups g ON g.id = gb.group_id
     WHERE gb.book_id = ? ORDER BY g.name COLLATE NOCASE, g.id`,
    [bookId],
  );
  return rows.map(toGroup);
}

/** Every user group (A-Z, including empty ones) with its books in shelf order. */
export async function groupBooksByGroup(db: Db): Promise<BookGroup<Group>[]> {
  const rows = await db.all<BookRow & { g_id: number; g_name: string; g_colour: string | null; g_icon: string | null; g_created_at: string }>(
    `SELECT ${BOOK_COLUMNS}, g.id AS g_id, g.name AS g_name, g.colour AS g_colour, g.icon AS g_icon, g.created_at AS g_created_at
     FROM groups g
     LEFT JOIN group_books gb ON gb.group_id = g.id
     LEFT JOIN books b ON b.id = gb.book_id
     ORDER BY g.name COLLATE NOCASE, g.id, gb.position, b.title COLLATE NOCASE, b.id`,
  );
  return foldBookGroups(rows, (r) => ({ id: r.g_id, name: r.g_name, colour: r.g_colour, icon: r.g_icon, createdAt: r.g_created_at }));
}
