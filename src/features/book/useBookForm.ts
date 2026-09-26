import { useCallback, useEffect, useState } from 'react';

import { authorsRepo, booksRepo, genresRepo, useDatabase } from '@/db';
import {
  addDraftAuthor,
  addDraftGenre,
  draftFromDetail,
  draftsDiffer,
  emptyDraft,
  firstInvalidField,
  validateBookDraft,
  type BookDraft,
  type BookDraftErrors,
  type BookDraftField,
} from '@/domain';
import { emit } from '@/features/events';
import { isStoredCover, storeCoverFile } from '@/services/covers';

export type SubmitResult = { ok: true; id: number; title: string } | { ok: false; firstInvalid: BookDraftField | null };

export interface BookFormState {
  status: 'loading' | 'ready' | 'missing';
  draft: BookDraft;
  setField: <K extends BookDraftField>(field: K, value: BookDraft[K]) => void;
  errors: BookDraftErrors;
  /** Text typed in the author and genre boxes but not yet added; Save includes it. */
  authorText: string;
  setAuthorText: (text: string) => void;
  genreText: string;
  setGenreText: (text: string) => void;
  /** Anything changed since the form opened (or was last saved). */
  dirty: boolean;
  saving: boolean;
  submit: () => Promise<SubmitResult>;
  suggestAuthors: (prefix: string) => Promise<string[]>;
  existingGenres: string[];
}

/**
 * The add/edit book form: loads the book (when editing), keeps the draft and
 * its errors, and saves it in one repository transaction, then emits
 * `library-changed`.
 */
export function useBookForm(id: number | null): BookFormState {
  const db = useDatabase();
  const editing = id != null;
  const [status, setStatus] = useState<BookFormState['status']>(editing ? 'loading' : 'ready');
  const [initial, setInitial] = useState<BookDraft>(emptyDraft);
  const [draft, setDraft] = useState<BookDraft>(emptyDraft);
  const [errors, setErrors] = useState<BookDraftErrors>({});
  const [authorText, setAuthorText] = useState('');
  const [genreText, setGenreText] = useState('');
  const [saving, setSaving] = useState(false);
  const [existingGenres, setExistingGenres] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    genresRepo
      .listGenres(db)
      .then((gs) => active && setExistingGenres(gs.map((g) => g.name)))
      .catch(() => {});
    if (id != null) {
      booksRepo
        .getBookDetail(db, id)
        .then((book) => {
          if (!active) return;
          if (!book) return setStatus('missing');
          const d = draftFromDetail(book);
          setInitial(d);
          setDraft(d);
          setStatus('ready');
        })
        .catch((e) => {
          console.error('Could not load the book to edit', e);
          if (active) setStatus('missing');
        });
    }
    return () => {
      active = false;
    };
  }, [db, id]);

  const setField = useCallback(<K extends BookDraftField>(field: K, value: BookDraft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  }, []);

  const suggestAuthors = useCallback(
    async (prefix: string) => (await authorsRepo.searchAuthors(db, prefix)).map((a) => a.name),
    [db],
  );

  const submit = useCallback(async (): Promise<SubmitResult> => {
    // Include a name or genre that was typed but not added yet.
    const full: BookDraft = {
      ...draft,
      authors: addDraftAuthor(draft.authors, authorText),
      genres: addDraftGenre(draft.genres, genreText, existingGenres),
    };
    const result = validateBookDraft(full);
    setDraft(full);
    setAuthorText('');
    setGenreText('');
    if (!result.ok) {
      setErrors(result.errors);
      return { ok: false, firstInvalid: firstInvalidField(result.errors) };
    }
    setErrors({});
    setSaving(true);
    try {
      const savedId = await booksRepo.saveBookDraft(db, result.value, id ?? undefined);
      // A picked or photographed cover is a temporary file: keep a copy with the book.
      const cover = result.value.coverUri;
      if (cover && cover.startsWith('file:') && !isStoredCover(savedId, cover)) {
        const stored = storeCoverFile(savedId, cover);
        await booksRepo.updateBook(db, savedId, { coverUri: stored });
      }
      setInitial(full);
      emit('library-changed');
      return { ok: true, id: savedId, title: result.value.title };
    } finally {
      setSaving(false);
    }
  }, [db, draft, authorText, genreText, existingGenres, id]);

  const dirty = draftsDiffer(draft, initial) || authorText.trim() !== '' || genreText.trim() !== '';

  return {
    status,
    draft,
    setField,
    errors,
    authorText,
    setAuthorText,
    genreText,
    setGenreText,
    dirty,
    saving,
    submit,
    suggestAuthors,
    existingGenres,
  };
}
