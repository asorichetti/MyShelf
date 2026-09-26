import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';

import { BookForm, type BookFormHandle } from '@/components/book/BookForm';
import { Booky } from '@/components/booky';
import { ConfirmDialog, Screen, Text, useSnackbar } from '@/components/ui';

import { BookMissing, goBackOrShelf } from './BookDetailScreen';
import { parseBookId } from './useBook';
import { useBookForm } from './useBookForm';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

function BookFormScreen({ bookId }: { bookId: number | null }) {
  const mode = bookId == null ? 'add' : 'edit';
  const form = useBookForm(bookId);
  const formRef = useRef<BookFormHandle>(null);
  const { show } = useSnackbar();
  const guard = useUnsavedChangesGuard(form.dirty && !form.saving);

  if (form.status === 'missing') return <BookMissing />;
  if (form.status === 'loading') {
    return (
      <Screen pageState="loading" centered edges={[...EDGES]}>
        <Text color="inkMuted" align="center">
          Fetching the card from the drawer…
        </Text>
      </Screen>
    );
  }

  const save = async () => {
    try {
      const result = await form.submit();
      if (!result.ok) {
        if (result.firstInvalid) requestAnimationFrame(() => formRef.current?.focusField(result.firstInvalid!));
        return;
      }
      guard.release();
      if (mode === 'add') {
        router.replace({ pathname: '/book/[id]', params: { id: String(result.id) } });
        show({ message: `Saved “${result.title}” to your shelf` });
      } else {
        goBackOrShelf();
        show({ message: 'Saved your changes' });
      }
    } catch (e) {
      console.error('Could not save the book', e);
      show({ message: 'Sorry, I couldn’t save that. Please try again.' });
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
      />
      <ConfirmDialog
        visible={guard.asking}
        illustration={<Booky expression="concerned" size={64} animated={false} />}
        title="Discard your changes?"
        message={mode === 'add' ? 'This book hasn’t been saved to your shelf yet.' : 'Your edits to this card haven’t been saved.'}
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        destructive
        onCancel={guard.keepEditing}
        onConfirm={guard.discard}
      />
    </Screen>
  );
}

/** `/book/new`: type up a new book. */
export function AddBookScreen() {
  return <BookFormScreen bookId={null} />;
}

/** `/book/[id]/edit`: edit every field of a book. */
export function EditBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = parseBookId(id);
  if (bookId == null) return <BookMissing />;
  return <BookFormScreen key={bookId} bookId={bookId} />;
}

