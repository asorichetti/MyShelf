import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';

import { BookForm, type BookFormHandle } from '@/components/book/BookForm';
import { Booky } from '@/components/booky';
import { ConfirmDialog, Screen, Text, useSnackbar } from '@/components/ui';
import type { BookDraft } from '@/domain';
import { useAddBookLookup } from '@/features/lookup/useAddBookLookup';
import { getPrefill, type Prefill } from '@/features/scan/prefill';
import { useSeriesOptions } from '@/features/series/useSeriesOptions';
import { useMounted } from '@/hooks/useMounted';
import { t } from '@/i18n';

import { BookMissing, goBackOrShelf } from './BookDetailScreen';
import { pickCover, type CoverSource } from './pickCover';
import { parseBookId } from './useBook';
import { useBookForm } from './useBookForm';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

function BookFormScreen({ bookId, prefill, scanned }: { bookId: number | null; prefill?: Partial<BookDraft>; scanned?: Prefill | null }) {
  const mode = bookId == null ? 'add' : 'edit';
  const form = useBookForm(bookId, prefill);
  const existingSeries = useSeriesOptions();
  const formRef = useRef<BookFormHandle>(null);
  const { show } = useSnackbar();
  const mounted = useMounted();
  const guard = useUnsavedChangesGuard(form.dirty && !form.saving);
  const lookup = useAddBookLookup(mode, form, (field) => formRef.current?.focusField(field), scanned);

  if (form.status === 'missing') return <BookMissing />;
  if (form.status === 'loading') {
    return (
      <Screen pageState="loading" centered edges={[...EDGES]}>
        <Text color="inkMuted" align="center">
          {t('book.loading')}
        </Text>
      </Screen>
    );
  }

  const chooseCover = async (source: CoverSource) => {
    try {
      const result = await pickCover(source);
      if (result.status === 'picked') form.setField('coverUri', result.uri);
      else if (result.status === 'denied') show({ message: t('bookForm.screen.cameraDenied') });
    } catch (e) {
      console.error('Could not pick a cover', e);
      show({ message: t('bookForm.screen.photosFailed') });
    }
  };

  const save = async () => {
    try {
      const result = await form.submit();
      if (!result.ok) {
        if (result.firstInvalid && mounted.current) requestAnimationFrame(() => formRef.current?.focusField(result.firstInvalid!));
        return;
      }
      guard.release();
      lookup.afterSave(result.id);
      // The book is saved either way; a form the user has already left does not navigate again.
      if (mode === 'add') {
        if (mounted.current) router.replace({ pathname: '/book/[id]', params: { id: String(result.id) } });
        show({ message: t('bookForm.screen.savedNew', { title: result.title }) });
      } else {
        if (mounted.current) goBackOrShelf();
        show({ message: t('bookForm.screen.savedChanges') });
      }
    } catch (e) {
      console.error('Could not save the book', e);
      show({ message: t('common.saveFailed') });
    }
  };

  return (
    <Screen scroll={false} edges={[...EDGES]} contentStyle={{ padding: 0, gap: 0, flex: 1 }}>
      <BookForm
        ref={formRef}
        mode={mode}
        draft={form.draft}
        errors={form.errors}
        onChange={form.setField}
        authorText={form.authorText}
        onAuthorTextChange={form.setAuthorText}
        suggestAuthors={form.suggestAuthors}
        genreText={form.genreText}
        onGenreTextChange={form.setGenreText}
        existingGenres={form.existingGenres}
        saving={form.saving}
        onSave={save}
        onCancel={goBackOrShelf}
        onPickCover={chooseCover}
        existingSeries={existingSeries}
        onFindCoverOnline={lookup.findCoverOnline}
        header={lookup.panel}
        seriesSuggestion={lookup.seriesSuggestion}
      />
      <ConfirmDialog
        visible={guard.asking}
        illustration={<Booky expression="concerned" size={64} animated={false} />}
        title={t('bookForm.screen.discardTitle')}
        message={mode === 'add' ? t('bookForm.screen.discardNew') : t('bookForm.screen.discardEdit')}
        cancelLabel={t('bookForm.screen.keepEditing')}
        confirmLabel={t('bookForm.screen.discard')}
        destructive
        onCancel={guard.keepEditing}
        onConfirm={guard.discard}
      />
    </Screen>
  );
}

/**
 * `/book/new`: type up a new book. `?series=Discworld&position=2` starts it in a series ("Add #2", P04-05);
 * `?prefill=<id>` starts it with what a scan found (P03-11).
 */
export function AddBookScreen() {
  const { series, position, prefill: prefillId } = useLocalSearchParams<{ series?: string; position?: string; prefill?: string }>();
  const scanned = getPrefill(typeof prefillId === 'string' ? prefillId : null);
  const inSeries = series ? { seriesName: String(series), seriesPosition: position ? String(position) : '' } : undefined;
  const prefill = scanned || inSeries ? { ...scanned?.draft, ...inSeries } : undefined;
  return <BookFormScreen bookId={null} prefill={prefill} scanned={scanned} />;
}

/** `/book/[id]/edit`: edit every field of a book. */
export function EditBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = parseBookId(id);
  if (bookId == null) return <BookMissing />;
  return <BookFormScreen key={bookId} bookId={bookId} />;
}

