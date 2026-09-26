import { candidateToDraft, cleanOcrLine, type BookDraft, type BookDraftField, type OcrQuery } from '@/domain';
import type { BookCandidate } from '@/services/metadata';

/**
 * What the add form starts with when a scan hits a dead end (P03-11): the
 * ISBN from a barcode, title and author guesses from the cover (marked
 * "please check"), or a whole candidate the user wants to review before
 * saving (P03-09). Opened as `/book/new?prefill=<id>`; nothing is saved
 * until the user taps Save.
 */
export interface Prefill {
  draft: Partial<BookDraft>;
  /** Fields filled from a guess, which the form asks the user to check. */
  guessed: BookDraftField[];
  /** The candidate a "Review before saving" came from: its source and cover are kept on save. */
  candidate: BookCandidate | null;
}

const prefills = new Map<string, Prefill>();
let counter = 0;

export function putPrefill(prefill: Prefill): string {
  counter += 1;
  const id = `p${Date.now().toString(36)}${counter}`;
  prefills.set(id, prefill);
  return id;
}

export function getPrefill(id: string | null | undefined): Prefill | null {
  return (id && prefills.get(id)) || null;
}

/** "the colour of magic" → "The Colour Of Magic": a readable guess from a lower-cased query. */
export function titleCase(text: string): string {
  return cleanOcrLine(text)
    .toLowerCase()
    .replace(/(^|[\s(“"‘-])(\p{L})/gu, (_, before: string, letter: string) => `${before}${letter.toUpperCase()}`);
}

/**
 * The form draft for a dead end: the scanned ISBN, and the cover's title
 * and author guesses. Guesses are marked so the form can ask the user to
 * check them; a barcode's ISBN is exact and is not.
 */
export function prefillFromScan({ isbn13, guess }: { isbn13?: string | null; guess?: OcrQuery | null }): Prefill {
  const draft: Partial<BookDraft> = {};
  const guessed: BookDraftField[] = [];
  if (isbn13) draft.isbn = isbn13;
  const title = guess?.title ?? (guess?.author ? undefined : guess?.text);
  if (title?.trim()) {
    draft.title = titleCase(title);
    guessed.push('title');
  }
  if (guess?.author?.trim()) {
    draft.authors = [{ name: titleCase(guess.author), role: 'author', sortName: null }];
    guessed.push('authors');
  }
  return { draft, guessed, candidate: null };
}

/** "Review before saving": the whole candidate in the form, with its origin kept. */
export function prefillFromCandidate(candidate: BookCandidate, existingGenres: readonly string[] = []): Prefill {
  return { draft: candidateToDraft(candidate, { existingGenres }), guessed: [], candidate };
}
