import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { sourceLabels } from '@/components/book/CandidateCard';
import { LookupPanel } from '@/components/book/LookupPanel';
import { useSnackbar } from '@/components/ui';
import { booksRepo, useDatabase } from '@/db';
import { bookMatchKey, candidateSeries, candidateToDraft, draftFieldOrder, type BookDraft, type BookDraftField } from '@/domain';
import { attachBestCover, includeGoogleCovers } from '@/features/covers';
import { emit } from '@/features/events';
import { combineCoverSources, coverSourceFromCandidate, resolveCover, type CoverSource } from '@/services/covers';
import { isAbortError, OfflineError } from '@/services/http';
import { toIsbn13, type BookCandidate } from '@/services/metadata';

import { getLookupServices, useMetadataService } from './metadataService';
import { useLookup, type LookupState } from './useLookup';

/** What the add/edit form exposes to the lookup. */
export interface LookupForm {
  draft: BookDraft;
  setField: <K extends BookDraftField>(field: K, value: BookDraft[K]) => void;
  existingGenres: readonly string[];
}

export interface AddBookLookup {
  /** The "Find it online" panel for the top of the add form (null when editing). */
  panel: ReactNode;
  /** BookForm's `onFindCoverOnline`: find the best real cover and put it on the card. */
  findCoverOnline: () => void;
  /** Call once the form saved: records where the details came from and stores the real cover. */
  afterSave: (bookId: number) => void;
  /** Fills the form from a candidate (also used by the scan prefill). */
  applyCandidate: (candidate: BookCandidate) => void;
  /** The chosen candidate's series guess, for the series picker's "Suggested: Discworld #5" chip. */
  seriesSuggestion: { name: string; position: number | null } | null;
}

const WARNINGS: Record<string, string> = {
  googlebooks: 'Google Books didn’t answer, so these come from Open Library only.',
  openlibrary: 'Open Library didn’t answer, so these come from Google Books only.',
};

function warningText(state: LookupState): string | null {
  if (state.status !== 'results') return null;
  const failed = state.warnings.find((w) => w.reason !== 'rate-limited' || state.warnings.length === 1);
  return failed ? (WARNINGS[failed.provider] ?? null) : null;
}

/**
 * The online side of the book form (P02-11): the "Find it online" panel on
 * the add form, filling the card from a chosen candidate, "Find a cover
 * online", and — once saved — the book's source and its best real cover
 * (`attachBestCover`, P02-15). `focusField` lets "Add it by hand" move to
 * the title.
 */
export function useAddBookLookup(mode: 'add' | 'edit', form: LookupForm, focusField: (field: BookDraftField) => void): AddBookLookup {
  const db = useDatabase();
  const service = useMetadataService();
  const lookup = useLookup({ service });
  const { show } = useSnackbar();
  const [chosen, setChosen] = useState<BookCandidate | null>(null);
  const [seriesSuggestion, setSeriesSuggestion] = useState<AddBookLookup['seriesSuggestion']>(null);
  // The latest form and lookup, for the callbacks below (updated after each render).
  const formRef = useRef(form);
  const lookupRef = useRef(lookup);
  useEffect(() => {
    formRef.current = form;
    lookupRef.current = lookup;
  });
  /** The real cover shown on the card and where it came from, so saving can store the best version of it. */
  const onlineCover = useRef<{ url: string; source: CoverSource } | null>(null);
  const origin = useRef<BookCandidate | null>(null);

  const applyCandidate = useCallback((candidate: BookCandidate) => {
    const { setField, existingGenres, draft } = formRef.current;
    const next = candidateToDraft(candidate, { existingGenres });
    // A provider's series with a number goes straight in; a weaker guess is only suggested.
    const series = candidateSeries(candidate);
    const fillSeries = series?.confidence === 'high';
    for (const field of draftFieldOrder) {
      if (field === 'notes') continue; // the user's own notes stay
      if (!fillSeries && (field === 'seriesName' || field === 'seriesPosition')) continue;
      setField(field, next[field] as never);
    }
    setSeriesSuggestion(series ? { name: series.name, position: series.position } : null);
    // Keep a cover the user chose themselves; otherwise show the real one.
    const ownCover = draft.coverUri && draft.coverUri !== onlineCover.current?.url;
    if (!ownCover) {
      setField('coverUri', next.coverUri);
      onlineCover.current = next.coverUri ? { url: next.coverUri, source: coverSourceFromCandidate(candidate) } : null;
    }
    origin.current = candidate;
    setChosen(candidate);
  }, []);

  const addManually = useCallback(() => {
    const { state } = lookupRef.current;
    if (state.status !== 'idle' && state.mode === 'isbn' && !formRef.current.draft.isbn.trim()) {
      const isbn = toIsbn13(state.query);
      if (isbn) formRef.current.setField('isbn', isbn);
    }
    lookupRef.current.reset();
    requestAnimationFrame(() => focusField('title'));
  }, [focusField]);

  const findCoverOnline = useCallback(async () => {
    const { draft, setField } = formRef.current;
    const author = draft.authors[0]?.name;
    const isbn = toIsbn13(draft.isbn);
    if (!isbn && !(draft.title.trim() && author)) {
      show({ message: 'Add the ISBN, or the title and author, and I’ll look for the cover.' });
      return;
    }
    try {
      let source: CoverSource = origin.current ? coverSourceFromCandidate(origin.current) : { isbn13: isbn };
      if (isbn) {
        const [candidate] = (await service.lookupIsbn(isbn)).candidates;
        if (candidate) source = combineCoverSources(source, coverSourceFromCandidate(candidate));
      } else if (author) {
        const { candidates } = await service.search({ title: draft.title.trim(), author });
        const match = candidates.find((c) => c.authors[0] && bookMatchKey(c.title, c.authors[0]) === bookMatchKey(draft.title, author));
        if (match) source = combineCoverSources(source, coverSourceFromCandidate(match));
      }
      const { http } = getLookupServices(db);
      const { cover } = await resolveCover(source, { http, includeGoogle: await includeGoogleCovers(db) });
      if (!cover) {
        show({ message: 'I couldn’t find a cover online for this one. You can photograph yours instead.' });
        return;
      }
      setField('coverUri', cover.url);
      onlineCover.current = { url: cover.url, source };
      show({ message: 'Found the cover and put it on the card.' });
    } catch (error) {
      if (isAbortError(error)) return;
      show({
        message:
          error instanceof OfflineError ? 'I can’t reach the catalogues right now. Try again when you’re online.' : 'Sorry, I couldn’t look for a cover just now.',
      });
    }
  }, [db, service, show]);

  const afterSave = useCallback(
    (bookId: number) => {
      const saved = formRef.current.draft.coverUri;
      const candidate = origin.current;
      const cover = onlineCover.current;
      void (async () => {
        try {
          if (candidate && mode === 'add') await booksRepo.updateBook(db, bookId, { source: candidate.source, sourceId: candidate.sourceId });
          // The card shows an online cover: store the best real version of it (a file on the phone).
          if (cover && saved === cover.url) {
            const { http } = getLookupServices(db);
            const result = await attachBestCover(db, bookId, cover.source, { http, replace: true, includeGoogle: await includeGoogleCovers(db) });
            if (result.status !== 'attached') return;
          } else if (!candidate || mode !== 'add') return;
          emit('library-changed');
        } catch (error) {
          console.warn('Could not store the book’s source or cover', error);
        }
      })();
    },
    [db, mode],
  );

  const { state } = lookup;
  const panel =
    mode === 'add' ? (
      <LookupPanel
        status={state.status}
        mode={state.status === 'idle' ? undefined : state.mode}
        query={state.status === 'idle' ? undefined : state.query}
        message={state.status === 'error' ? state.message : undefined}
        candidates={state.status === 'results' ? state.candidates : []}
        warning={warningText(state)}
        chosen={chosen ? { title: chosen.title, source: sourceLabels[chosen.source] } : null}
        onLookupIsbn={lookup.lookupIsbn}
        onSearch={lookup.search}
        onCancel={lookup.cancel}
        onChoose={(i) => state.status === 'results' && applyCandidate(state.candidates[i])}
        onAddManually={addManually}
        onSearchAgain={() => {
          setChosen(null);
          lookup.reset();
        }}
      />
    ) : null;

  return { panel, findCoverOnline, afterSave, applyCandidate, seriesSuggestion };
}
