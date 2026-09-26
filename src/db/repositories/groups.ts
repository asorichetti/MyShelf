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

export async function removeBookFromGroup(db: Db, groupId: number, bookId: number): Promise<boolean> {
  return (await db.run('DELETE FROM group_books WHERE group_id = ? AND book_id = ?', [groupId, bookId])).changes > 0;
}

export async function listBooksInGroup(db: Db, groupId: number): Promise<Book[]> {
  const rows = await db.all<BookRow>(
    `SELECT ${BOOK_COLUMNS} FROM group_books gb JOIN books b ON b.id = gb.book_id
     WHERE gb.group_id = ? ORDER BY gb.position, b.title COLLATE NOCASE, b.id`,
    [groupId],
  );
  return rows.map(toBook);
}

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
