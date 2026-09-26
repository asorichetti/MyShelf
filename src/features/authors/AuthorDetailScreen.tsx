import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookRow } from '@/components/book/BookRow';
import { SectionHeader } from '@/components/book/SectionHeader';
import { Booky } from '@/components/booky';
import { Button, ConfirmDialog, Heading, IconButton, Screen, Sheet, Text, TextField, TopBar, useSnackbar } from '@/components/ui';
import type { AuthorWithCount } from '@/db';
import { toSortName, type Author } from '@/domain';
import { goBackOr } from '@/features/navigation/goBack';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { MissingScreen } from '@/features/navigation/MissingScreen';
import { parseId } from '@/features/navigation/parseId';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useAuthor } from './useAuthor';
import { useAuthors } from './useAuthors';

const books = (n: number) => (n === 1 ? '1 book' : `${n} books`);

function EditAuthorSheet({ author, onSave, onClose }: { author: Author; onSave: (name: string, sortName: string | null) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(author.name);
  const [sortName, setSortName] = useState(author.sortName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) {
      setError('An author needs a name.');
      return;
    }
    setBusy(true);
    try {
      await onSave(name.trim(), sortName.trim() || toSortName(name));
      onClose();
    } catch (e) {
      console.error('Could not save the author', e);
      setError('Sorry, I couldn’t save that. Please try again.');
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible
      title="Edit author"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" label="Cancel" onPress={onClose} disabled={busy} />
          <Button label="Save" onPress={save} loading={busy} testID={Testids.authors.editSave} />
        </>
      }
    >
      <TextField label="Name" value={name} onChangeText={setName} errorText={error ?? undefined} testID={Testids.authors.editName} />
      <TextField
        label="Filed under"
        value={sortName}
        onChangeText={setSortName}
        placeholder={toSortName(name)}
        helperText="How the author is sorted, surname first, e.g. “Pratchett, Terry”."
        testID={Testids.authors.editSortName}
      />
    </Sheet>
  );
}

function MergeAuthorSheet({ author, authors, onPick, onClose }: { author: Author; authors: AuthorWithCount[]; onPick: (a: AuthorWithCount) => void; onClose: () => void }) {
  const { colors, spacing, radii, sizes } = useTheme();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const others = authors.filter((a) => a.id !== author.id && (!q || a.name.toLowerCase().includes(q)));
  return (
    <Sheet
      visible
      title={`Merge “${author.name}” into…`}
      subtitle="For duplicates like “J.R.R. Tolkien” and “J. R. R. Tolkien”: the books move to the author you choose."
      onClose={onClose}
      footer={<Button variant="secondary" label="Cancel" onPress={onClose} />}
    >
      <TextField label="Find an author" value={query} onChangeText={setQuery} autoCapitalize="none" />
      <View role="list" style={{ gap: spacing.xxs }}>
        {others.slice(0, 50).map((a) => (
          <Pressable
            key={a.id}
            role="button"
            accessibilityLabel={`${a.name}, ${books(a.count)}`}
            onPress={() => onPick(a)}
            testID={Testids.authors.mergeOption}
            style={({ pressed }) => [styles.option, { minHeight: sizes.touchTarget, paddingHorizontal: spacing.md, gap: spacing.md, borderRadius: radii.md }, pressed && { backgroundColor: colors.surfaceTint }]}
          >
            <Text variant="bodyStrong" style={styles.flex}>
              {a.name}
            </Text>
            <Text variant="caption" color="inkMuted">
              {books(a.count)}
            </Text>
          </Pressable>
        ))}
        {others.length === 0 ? <Text color="inkMuted">No other author matches.</Text> : null}
      </View>
    </Sheet>
  );
}

/** `/authors/[id]`: an author's books, grouped by series (reading order) then standalone (by year); edit and merge. */
export function AuthorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, update, mergeInto } = useAuthor(parseId(id));
  const authors = useAuthors();
  const { spacing } = useTheme();
  const { show } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [target, setTarget] = useState<AuthorWithCount | null>(null);
  const [busy, setBusy] = useState(false);
  const open = useCallback((bookId: number) => router.navigate({ pathname: '/book/[id]', params: { id: String(bookId) } }), []);

  if (state.status === 'loading') return <LoadingPage />;
  if (state.status === 'missing') {
    return <MissingScreen title="Author not found" message="That author isn’t in your catalogue any more. They may have been merged with another." fallback="/authors" />;
  }
  const { author, shelves, count } = state;

  const confirmMerge = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const kept = await mergeInto(target.id);
      setTarget(null);
      setBusy(false);
      if (kept) {
        show({ message: `Merged into ${kept.name}` });
        router.replace({ pathname: '/authors/[id]', params: { id: String(kept.id) } });
      }
    } catch (e) {
      console.error('Could not merge the authors', e);
      setBusy(false);
      setTarget(null);
      show({ message: 'Sorry, I couldn’t merge those authors. Please try again.' });
    }
  };

  return (
    <Screen testID={Testids.authors.detail} edges={['top', 'bottom', 'left', 'right']}>
      <TopBar onBack={() => goBackOr('/authors')}>
        <IconButton icon="pencil-outline" variant="tonal" accessibilityLabel={`Edit ${author.name}`} onPress={() => setEditing(true)} testID={Testids.authors.edit} />
        <IconButton icon="call-merge" accessibilityLabel={`Merge ${author.name} with another author`} onPress={() => setMerging(true)} testID={Testids.authors.merge} />
      </TopBar>
      <View style={{ gap: spacing.xs }}>
        <Text variant="stamp" color="accent">
          Author
        </Text>
        <Heading level={1} testID={Testids.authors.detailTitle}>
          {author.name}
        </Heading>
        {author.sortName && author.sortName !== author.name ? (
          <Text variant="mono" color="inkMuted">
            Filed under {author.sortName}
          </Text>
        ) : null}
        <Text color="inkMuted">{books(count)} on your shelf</Text>
      </View>
      {shelves.map((shelf) => (
        <View key={shelf.key} testID={Testids.authors.detailSection} style={{ gap: spacing.md }}>
          <SectionHeader
            title={shelf.title}
            count={shelf.items.length}
            onOpen={shelf.seriesId != null ? () => router.navigate({ pathname: '/series/[id]', params: { id: String(shelf.seriesId) } }) : undefined}
          />
          {shelf.items.map((item) => (
            <BookRow key={item.id} item={item} onPress={open} />
          ))}
        </View>
      ))}
      {count === 0 ? <Text color="inkMuted">No books by this author yet.</Text> : null}
      {editing ? <EditAuthorSheet author={author} onSave={(name, sortName) => update({ name, sortName })} onClose={() => setEditing(false)} /> : null}
      {merging && authors ? (
        <MergeAuthorSheet
          author={author}
          authors={authors}
          onPick={(a) => {
            setMerging(false);
            setTarget(a);
          }}
          onClose={() => setMerging(false)}
        />
      ) : null}
      <ConfirmDialog
        visible={target != null}
        illustration={<Booky expression="thinking" size={72} animated={false} />}
        title={target ? `Merge into ${target.name}?` : 'Merge?'}
        message={target ? `${author.name}’s ${books(count)} will be credited to ${target.name}, and “${author.name}” goes away.` : undefined}
        confirmLabel="Merge"
        busy={busy}
        onConfirm={confirmMerge}
        onCancel={() => setTarget(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
