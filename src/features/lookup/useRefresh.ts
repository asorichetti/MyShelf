import { useCallback, useEffect, useRef, useState } from 'react';

import { booksRepo, genresRepo, useDatabase } from '@/db';
import {
  applyChanges,
  bookMatchKey,
  candidateSeries,
  candidateToDraft,
  diffDrafts,
  draftFromDetail,
  validateBookDraft,
  type BookDetail,
  type BookDraft,
  type CurrentBook,
  type FieldChange,
  type RefreshField,
} from '@/domain';
import { attachCoverFromCandidate } from '@/features/covers';
import { emit } from '@/features/events';
import { applyDetectedSeries } from '@/features/series/detectedSeries';
import { beginSeriesSave } from '@/features/series/seriesEvents';
import { idListHas } from '@/features/series/seriesSettings';
import { t } from '@/i18n';
import { isAbortError, OfflineError } from '@/services/http';
import type { BookCandidate, MetadataService } from '@/services/metadata';

import { useMetadataService } from './metadataService';

export type RefreshState =
  | { status: 'loading' }
  | { status: 'missing' }
  /** Neither catalogue knows the book (or a search found only other books). */
  | { status: 'not-found'; book: BookDetail }
  | { status: 'error'; book: BookDetail | null; message: string }
  | { status: 'ready'; book: BookDetail; candidate: BookCandidate; proposed: BookDraft; changes: FieldChange[] };

export interface Refresh {
  state: RefreshState;
  ticked: ReadonlySet<RefreshField>;
  toggle: (field: RefreshField) => void;
  applying: boolean;
  /**
   * Saves the ticked changes; resolves with how many fields changed (0 when
   * nothing was ticked), or null when a save is already running.
   */
  apply: () => Promise<number | null>;
}

/** The candidate describing this book: by ISBN, else a title + first author search that must match. */
async function findCandidate(book: BookDetail, service: MetadataService, signal: AbortSignal): Promise<BookCandidate | null> {
  const isbn = book.isbn13 ?? book.isbn10;
  if (isbn) return (await service.lookupIsbn(isbn, { signal })).candidates[0] ?? null;
  const author = book.authors[0]?.name;
  const { candidates } = await service.search(author ? { title: book.title, author } : { title: book.title }, { signal });
  const key = bookMatchKey(book.title, author);
  return candidates.find((c) => bookMatchKey(c.title, c.authors[0]) === key) ?? null;
}

function currentOf(book: BookDetail): CurrentBook {
  return { draft: draftFromDetail(book), userGenres: book.genres.filter((g) => g.userEdited).map((g) => g.name) };
}

/**
 * "Refresh details" for an existing book (P02-12): looks the book up again
 * and lists what the catalogues would change, field by field. Additions are
 * ticked, replacements are not; the user's own genres are never removed.
 */
export function useRefresh(bookId: number | null, { service: injected }: { service?: MetadataService } = {}): Refresh {
  const db = useDatabase();
  const appService = useMetadataService();
  const service = injected ?? appService;
  const [state, setState] = useState<RefreshState>(bookId == null ? { status: 'missing' } : { status: 'loading' });
  const [ticked, setTicked] = useState<ReadonlySet<RefreshField>>(new Set());
  const [applying, setApplying] = useState(false);
  // A second tap while the first is still saving must not apply everything again.
  const busy = useRef(false);

  useEffect(() => {
    if (bookId == null) return;
    const abort = new AbortController();
    (async () => {
      const book = await booksRepo.getBookDetail(db, bookId);
      if (!book) return setState({ status: 'missing' });
      try {
        const candidate = await findCandidate(book, service, abort.signal);
        if (abort.signal.aborted) return;
        if (!candidate) return setState({ status: 'not-found', book });
        const existingGenres = (await genresRepo.listGenres(db)).map((g) => g.name);
        const proposed = candidateToDraft(candidate, { existingGenres });
        const proposedCover = Boolean(candidate.coverUrl || candidate.coverRefs?.olEditionCoverIds.length || candidate.coverRefs?.olWorkCoverIds.length);
        // A book the user said is "Not a series" is never offered one again (P04-03).
        const noSeries = await idListHas(db, 'series.dismissedBookIds', book.id);
        const changes = diffDrafts(currentOf(book), proposed, { hasCover: Boolean(book.coverUri), proposedCover }).filter(
          (c) => !(noSeries && c.field === 'series'),
        );
        setTicked(new Set(changes.filter((c) => c.suggested).map((c) => c.field)));
        setState({ status: 'ready', book, candidate, proposed, changes });
      } catch (error) {
        if (abort.signal.aborted || isAbortError(error)) return;
        setState({
          status: 'error',
          book,
          message: error instanceof OfflineError ? t('refresh.offline') : t('common.lookupFailed'),
        });
      }
    })().catch((error) => {
      console.error('Could not load the book to refresh', error);
      setState({ status: 'missing' });
    });
    return () => abort.abort();
  }, [db, bookId, service]);

  const toggle = useCallback((field: RefreshField) => {
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);

  const apply = useCallback(async () => {
    if (busy.current) return null;
    if (state.status !== 'ready' || !ticked.size) return 0;
    const { book, candidate, proposed } = state;
    busy.current = true;
    setApplying(true);
    try {
      const current = currentOf(book);
      // The series goes through the series feature, so a guess is confirmed and milestones announced.
      const withoutSeries = new Set([...ticked].filter((f) => f !== 'series'));
      const next = applyChanges(current, proposed, withoutSeries);
      const valid = validateBookDraft(next);
      if (!valid.ok) throw new Error(`Refreshed details did not validate: ${Object.keys(valid.errors).join(', ')}`);
      const series = ticked.has('series') ? candidateSeries(candidate) : null;
      const probe = await beginSeriesSave(db, { bookId: book.id, seriesNames: series ? [series.name] : [] });
      await booksRepo.refreshBook(db, book.id, valid.value, { userGenres: current.userGenres });
      if (series) await applyDetectedSeries(db, book.id, series);
      emit('library-changed');
      void probe.finish(book.id);
      if (ticked.has('cover')) {
        // Stores the best real cover in the background; the book is already saved.
        void attachCoverFromCandidate(db, book.id, candidate)
          .then((r) => r.status === 'attached' && emit('library-changed'))
          .catch(() => undefined);
      }
      return ticked.size;
    } finally {
      busy.current = false;
      setApplying(false);
    }
  }, [db, state, ticked]);

  return { state, ticked, toggle, applying, apply };
}
