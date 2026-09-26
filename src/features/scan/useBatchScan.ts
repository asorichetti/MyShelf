import { useSyncExternalStore } from 'react';

import { t } from '@/i18n';
import type { BookCandidate } from '@/services/metadata';

import type { ScanSession } from './sessionStore';

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
  /** What was scanned, for the row while it has no candidate. */
  label: string;
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
    label: first?.title ?? session.isbn13 ?? t('scan.tray.unknownBook'),
  };
  set([...items, item]);
  return item;
}

/** The user picked the edition for a waiting item. */
export function resolveTrayItem(id: string, candidate: BookCandidate): void {
  set(items.map((i) => (i.id === id ? { ...i, status: 'ready', candidate, sessionId: null, label: candidate.title } : i)));
}

export function dropTrayItem(id: string): void {
  set(items.filter((i) => i.id !== id));
}

export function removeTrayItems(ids: readonly string[]): void {
  set(items.filter((i) => !ids.includes(i.id)));
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
