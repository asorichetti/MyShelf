import { useSyncExternalStore } from 'react';

import { t } from '@/i18n';
import type { BookCandidate } from '@/services/metadata';

import { endSession, type ScanSession } from './sessionStore';

/**
 * The "Scan several" review tray (P03-12): books recognised but not yet
 * saved. Kept in memory for the app session, so leaving the Scan tab (which
 * unmounts it) keeps the tray.
 */
export interface TrayItem {
  id: string;
  /** `ready`: exactly one confident candidate; `needs-choice`: the user picks the edition first. */
  status: 'ready' | 'needs-choice';
  candidate: BookCandidate | null;
  /** The scan session to pick from when a choice is needed. */
  sessionId: string | null;
  /** The ISBN scanned, if any. */
  isbn13: string | null;
  /** What was scanned, for the row while it has no candidate. */
  label: string;
  /** Copies to save: scanning the same ISBN again adds one only when the user asks ("+1 copy"). */
  copies: number;
  /** Copies already on the shelf (`findDuplicates`), or null until the review has checked. */
  onShelf: number | null;
  /** The user chose to add it although the shelf has it ("Add it anyway"). */
  keep: boolean;
}

let items: readonly TrayItem[] = [];
let counter = 0;
const listeners = new Set<() => void>();

function set(next: readonly TrayItem[]) {
  items = next;
  for (const l of [...listeners]) l();
}

/** One confident candidate: an ISBN (barcode or typed) with exactly one match. */
export function isConfident(session: Pick<ScanSession, 'source' | 'candidates'>): boolean {
  return session.source !== 'cover' && session.candidates.length === 1;
}

/** Adds a scan to the tray: ready when confident, otherwise waiting for a choice. */
export function addToTray(session: ScanSession): TrayItem {
  counter += 1;
  const confident = isConfident(session);
  const first = session.candidates[0];
  const item: TrayItem = {
    id: `t${counter}`,
    status: confident ? 'ready' : 'needs-choice',
    candidate: confident ? first : null,
    sessionId: confident ? null : session.id,
    isbn13: session.isbn13 ?? null,
    label: first?.title ?? session.isbn13 ?? t('scan.tray.unknownBook'),
    copies: 1,
    onShelf: null,
    keep: false,
  };
  set([...items, item]);
  return item;
}

/** The ISBN a tray item or a scan stands for, if it has one. */
const isbnOf = (candidate: BookCandidate | null | undefined, isbn13?: string | null) => candidate?.isbn13 ?? isbn13 ?? null;

/**
 * The tray item a new scan repeats: one with the same ISBN (a book scanned
 * twice, on purpose or not). Null when the scan is new or has no ISBN.
 */
export function trayItemFor(session: Pick<ScanSession, 'source' | 'candidates' | 'isbn13'>): TrayItem | null {
  const isbn = isbnOf(isConfident(session) ? session.candidates[0] : null, session.isbn13);
  if (!isbn) return null;
  return items.find((i) => isbnOf(i.candidate, i.isbn13) === isbn) ?? null;
}

/** "+1 copy": one more copy of a book in the tray. */
export function addTrayCopy(id: string): void {
  set(items.map((i) => (i.id === id ? { ...i, copies: i.copies + 1 } : i)));
}

/** One copy fewer (never below one: dropping the book is "Drop"). */
export function removeTrayCopy(id: string): void {
  set(items.map((i) => (i.id === id && i.copies > 1 ? { ...i, copies: i.copies - 1 } : i)));
}

/** What the review found on the shelf for an item (for the candidate it was checked with). */
export function setTrayOnShelf(id: string, candidate: BookCandidate, onShelf: number): void {
  set(items.map((i) => (i.id === id && i.candidate === candidate ? { ...i, onShelf } : i)));
}

/** "Add it anyway": save an item the shelf already has. */
export function keepTrayItem(id: string): void {
  set(items.map((i) => (i.id === id ? { ...i, keep: true } : i)));
}

/** Whether an item is saved by "Save": an edition chosen, checked against the shelf, and new or kept. */
export function isTrayItemReady(item: TrayItem): item is TrayItem & { candidate: BookCandidate } {
  return item.status === 'ready' && item.candidate !== null && item.onShelf !== null && (item.onShelf === 0 || item.keep);
}

/** Books a tray item stands for on the Scan tab's counter. */
export const trayBookCount = (tray: readonly TrayItem[]) => tray.reduce((n, i) => n + i.copies, 0);

/** The user picked the edition for a waiting item (it is checked against the shelf again). */
export function resolveTrayItem(id: string, candidate: BookCandidate): void {
  set(items.map((i) => (i.id === id ? { ...i, status: 'ready', candidate, sessionId: null, label: candidate.title, onShelf: null, keep: false } : i)));
}

/** Drops a book from the tray; one still waiting for its edition takes its scan (and cover photo) with it. */
export function dropTrayItem(id: string): void {
  const sessionId = items.find((i) => i.id === id)?.sessionId;
  set(items.filter((i) => i.id !== id));
  if (sessionId) endSession(sessionId);
}

export function removeTrayItems(ids: readonly string[]): void {
  set(items.filter((i) => !ids.includes(i.id)));
}

/** After a save that stopped part-way: the copies of an item still to save. */
export function setTrayCopies(id: string, copies: number): void {
  set(items.map((i) => (i.id === id ? { ...i, copies } : i)));
}

export function getTray(): readonly TrayItem[] {
  return items;
}

export function clearTray(): void {
  set([]);
}

export function subscribeTray(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The tray, re-rendering on change. */
export function useTray(): readonly TrayItem[] {
  return useSyncExternalStore(subscribeTray, getTray, getTray);
}
