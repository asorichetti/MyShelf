import type { OcrQuery } from '@/domain';
import type { BookCandidate } from '@/services/metadata';

import { discardPhoto } from './tempPhoto';

/**
 * One recognised book on its way to the shelf: what was scanned and the
 * candidates found for it. The edition picker (`/scan/pick?session=<id>`)
 * reads it by id, so candidates never travel through the URL. Kept in memory
 * for the app session only: a reloaded picker says the scan has expired.
 */
export interface ScanSession {
  id: string;
  /** `barcode`: the camera; `isbn`: typed; `cover`: OCR or typed cover text. */
  source: 'barcode' | 'isbn' | 'cover';
  /** The ISBN looked up (barcode and typed ISBN). */
  isbn13: string | null;
  /** The cover's best search (title and author guesses), for "Add manually". */
  guess: OcrQuery | null;
  candidates: BookCandidate[];
  /** The cover photo taken for recognition, kept until the book is saved (P03-14). */
  photoUri: string | null;
  /** When the scan belongs to a batch tray item waiting for its edition (P03-12). */
  trayItemId: string | null;
}

const sessions = new Map<string, ScanSession>();
let counter = 0;

export function createSession(input: Omit<ScanSession, 'id' | 'photoUri' | 'trayItemId' | 'guess' | 'isbn13'> & Partial<ScanSession>): ScanSession {
  counter += 1;
  const session: ScanSession = { isbn13: null, guess: null, photoUri: null, trayItemId: null, ...input, id: `s${Date.now().toString(36)}${counter}` };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string | null | undefined): ScanSession | null {
  return (id && sessions.get(id)) || null;
}

export function updateSession(id: string, patch: Partial<Omit<ScanSession, 'id'>>): ScanSession | null {
  const current = sessions.get(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  sessions.set(id, next);
  return next;
}

/** Forgets a session and deletes its cover photo (P03-05: the photo is kept only until the book is saved). */
export function endSession(id: string, { keepPhoto = false }: { keepPhoto?: boolean } = {}): void {
  const session = sessions.get(id);
  sessions.delete(id);
  if (!keepPhoto) discardPhoto(session?.photoUri);
}

/** Tests: forget every session. */
export function clearSessions(): void {
  sessions.clear();
}
