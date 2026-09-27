import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { sourceLabels } from '@/components/book/CandidateCard';
import { LookupPanel } from '@/components/book/LookupPanel';
import { BookyBubble } from '@/components/booky';
import { useSnackbar } from '@/components/ui';
import { booksRepo, useDatabase } from '@/db';
import { bookMatchKey, candidateSeries, candidateToDraft, draftFieldOrder, joinNames, type BookDraft, type BookDraftField } from '@/domain';
import { attachBestCover, includeGoogleCovers } from '@/features/covers';
import { emit } from '@/features/events';
import { t, translate, type MessageKey } from '@/i18n';
import { combineCoverSources, coverSourceFromCandidate, resolveCover, type CoverSource } from '@/services/covers';
import { isAbortError, OfflineError } from '@/services/http';
import { toIsbn13, type BookCandidate } from '@/services/metadata';
import { Testids } from '@/testing/testids.gen';

import { clearPendingLookup } from './clearPendingLookup';
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

const WARNINGS: Record<string, MessageKey> = {
  googlebooks: 'lookup.warnings.googlebooks',
  openlibrary: 'lookup.warnings.openlibrary',
};

const guessLabels: Partial<Record<BookDraftField, MessageKey>> = { title: 'lookup.guess.fields.title', authors: 'lookup.guess.fields.authors', isbn: 'lookup.guess.fields.isbn' };

/** "Please check": the form was started from guesses (the words read off a cover). */
function GuessNotice({ fields }: { fields: readonly BookDraftField[] }) {
  const names = fields.map((f) => {
    const key = guessLabels[f];
    return key ? translate(key) : f;
  });
  return (
    <View testID={Testids.prefill.notice} role="status">
      <BookyBubble expression="thinking" title={t('lookup.guess.title')} message={t('lookup.guess.message', { count: names.length, fields: joinNames(names) })} />
    </View>
  );
}

function warningText(state: LookupState): string | null {
  if (state.status !== 'results') return null;
  const failed = state.warnings.find((w) => w.reason !== 'rate-limited' || state.warnings.length === 1);
  const key = failed ? WARNINGS[failed.provider] : undefined;
  return key ? translate(key) : null;
}

/**
 * The online side of the book form (P02-11): the "Find it online" panel on
 * the add form, filling the card from a chosen candidate, "Find a cover
 * online", and — once saved — the book's source and its best real cover
 * (`attachBestCover`, P02-15). `focusField` lets "Add it by hand" move to
 * the title.
 */
export function useAddBookLookup(
  mode: 'add' | 'edit',
  form: LookupForm,
  focusField: (field: BookDraftField) => void,
  /** What a scan already found (P03-11): a candidate to keep the origin and cover of, or guessed fields to check. */
  start?: { candidate: BookCandidate | null; guessed: readonly BookDraftField[] } | null,
): AddBookLookup {
  const db = useDatabase();
  const service = useMetadataService();
  const lookup = useLookup({ service });
  const { show } = useSnackbar();
  const [chosen, setChosen] = useState<BookCandidate | null>(start?.candidate ?? null);
  const [seriesSuggestion, setSeriesSuggestion] = useState<AddBookLookup['seriesSuggestion']>(() => {
    const series = start?.candidate ? candidateSeries(start.candidate) : null;
    return series ? { name: series.name, position: series.position } : null;
  });
  // The latest form and lookup, for the callbacks below (updated after each render).
  const formRef = useRef(form);
  const lookupRef = useRef(lookup);
  useEffect(() => {
    formRef.current = form;
    lookupRef.current = lookup;
  });
  /** The real cover shown on the card and where it came from, so saving can store the best version of it. */
  const onlineCover = useRef<{ url: string; source: CoverSource } | null>(
    start?.candidate?.coverUrl ? { url: start.candidate.coverUrl, source: coverSourceFromCandidate(start.candidate) } : null,
  );
  const origin = useRef<BookCandidate | null>(start?.candidate ?? null);

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

  // "Find a cover online" runs one search at a time, cancelled when the form goes.
  const coverSearch = useRef<AbortController | null>(null);
  useEffect(() => () => coverSearch.current?.abort(), []);

  const findCoverOnline = useCallback(async () => {
    const { draft } = formRef.current;
    const author = draft.authors[0]?.name;
    const isbn = toIsbn13(draft.isbn);
    if (!isbn && !(draft.title.trim() && author)) {
      show({ message: t('lookup.cover.needDetails') });
      return;
    }
    coverSearch.current?.abort();
    const abort = new AbortController();
    coverSearch.current = abort;
    const { signal } = abort;
    // The cover on the card when the search started: a photo picked (or a cover removed) meanwhile is newer and stays.
    const before = draft.coverUri;
    const stale = () => signal.aborted || formRef.current.draft.coverUri !== before;
    try {
      let source: CoverSource = origin.current ? coverSourceFromCandidate(origin.current) : { isbn13: isbn };
      if (isbn) {
        const [candidate] = (await service.lookupIsbn(isbn, { signal })).candidates;
        if (candidate) source = combineCoverSources(source, coverSourceFromCandidate(candidate));
      } else if (author) {
        const { candidates } = await service.search({ title: draft.title.trim(), author }, { signal });
        const match = candidates.find((c) => c.authors[0] && bookMatchKey(c.title, c.authors[0]) === bookMatchKey(draft.title, author));
        if (match) source = combineCoverSources(source, coverSourceFromCandidate(match));
      }
      if (stale()) return;
      const { http } = getLookupServices(db);
      const { cover } = await resolveCover(source, { http, signal, includeGoogle: await includeGoogleCovers(db) });
      if (stale()) return;
      if (!cover) {
        show({ message: t('lookup.cover.notFound') });
        return;
      }
      formRef.current.setField('coverUri', cover.url);
      onlineCover.current = { url: cover.url, source };
      show({ message: t('lookup.cover.found') });
    } catch (error) {
      if (isAbortError(error) || stale()) return;
      show({
        message: error instanceof OfflineError ? t('lookup.cover.offline') : t('lookup.cover.failed'),
      });
    } finally {
      if (coverSearch.current === abort) coverSearch.current = null;
    }
  }, [db, service, show]);

  const afterSave = useCallback(
    (bookId: number) => {
      const saved = formRef.current.draft.coverUri;
      const candidate = origin.current;
      const cover = onlineCover.current;
      void (async () => {
        try {
          if (candidate && mode === 'add') {
            await booksRepo.updateBook(db, bookId, { source: candidate.source, sourceId: candidate.sourceId });
            // Details that arrived for a book scanned offline, reviewed before saving (P02-10).
            if (await clearPendingLookup(db, candidate.isbn13)) emit('pending-changed');
          }
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
  const guessed = start?.guessed.length ? start.guessed : null;
  const panel =
    mode === 'add' ? (
      <>
      {guessed ? <GuessNotice fields={guessed} /> : null}
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
      </>
    ) : null;

  return { panel, findCoverOnline, afterSave, applyCandidate, seriesSuggestion };
}
