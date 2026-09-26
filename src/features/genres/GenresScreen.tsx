import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { Button, ConfirmDialog, EmptyState, Heading, IconButton, Screen, Sheet, Text, TextField, TopBar, useSnackbar } from '@/components/ui';
import { GenreNameTakenError, type GenreWithCount } from '@/db';
import { goBackOr } from '@/features/navigation/goBack';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useGenres } from './useGenres';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;
const books = (n: number) => (n === 1 ? '1 book' : `${n} books`);

type Pending =
  | { kind: 'rename'; genre: GenreWithCount }
  | { kind: 'pickMerge'; genre: GenreWithCount }
  | { kind: 'confirmMerge'; source: GenreWithCount; target: { id: number; name: string }; fromRename: boolean }
  | { kind: 'delete'; genre: GenreWithCount };

/**
 * `/genres`: every genre with its book count. Each can be opened, renamed
 * (renaming onto an existing name offers to merge the two), merged into
 * another genre, or deleted (books only lose the tag).
 */
export function GenresScreen() {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const { genres, rename, merge, remove } = useGenres();
  const { show } = useSnackbar();
  const [pending, setPending] = useState<Pending | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!genres) return <LoadingPage />;

  const close = () => {
    setPending(null);
    setError(null);
    setBusy(false);
  };

  const saveRename = async () => {
    if (pending?.kind !== 'rename') return;
    const clean = name.trim();
    if (!clean) {
      setError('A genre needs a name.');
      return;
    }
    setBusy(true);
    try {
      await rename(pending.genre.id, clean);
      show({ message: `Renamed to “${clean}”` });
      close();
    } catch (e) {
      setBusy(false);
      if (e instanceof GenreNameTakenError) {
        setPending({ kind: 'confirmMerge', source: pending.genre, target: e.existing, fromRename: true });
        return;
      }
      console.error('Could not rename the genre', e);
      setError('Sorry, I couldn’t rename it. Please try again.');
    }
  };

  const confirmMerge = async () => {
    if (pending?.kind !== 'confirmMerge') return;
    setBusy(true);
    try {
      const merged = await merge(pending.source.id, pending.target.id);
      show({ message: merged ? `Merged into “${merged.name}”: ${books(merged.count)}` : 'Those genres have already changed.' });
    } catch (e) {
      console.error('Could not merge the genres', e);
      show({ message: 'Sorry, I couldn’t merge those genres. Please try again.' });
    }
    close();
  };

  const confirmDelete = async () => {
    if (pending?.kind !== 'delete') return;
    setBusy(true);
    try {
      await remove(pending.genre.id);
      show({ message: `Deleted “${pending.genre.name}”` });
    } catch (e) {
      console.error('Could not delete the genre', e);
      show({ message: 'Sorry, I couldn’t delete that genre. Please try again.' });
    }
    close();
  };

  return (
    <Screen testID={Testids.genres.root} edges={[...EDGES]}>
      <TopBar onBack={() => goBackOr('/')} />
      <View style={{ gap: spacing.xs }}>
        <Heading level={1} testID={Testids.genres.title}>
          Genres
        </Heading>
        <Text color="inkMuted">Tidy your genres: rename them, merge near-duplicates, or open one to see its books.</Text>
      </View>
      {genres.length === 0 ? (
        <EmptyState
          testID={Testids.emptyState.root}
          illustration={<Booky expression="sleepy" size={112} />}
          title="No genres yet"
          message="Genres appear here as you add books. Lookups fill them in for you."
          action={{ label: 'Add a book', onPress: () => router.navigate('/book/new'), variant: 'secondary' }}
        />
      ) : (
        <View role="list" aria-label="Genres" style={{ gap: spacing.sm }}>
          {genres.map((g) => (
            <View
              key={g.id}
              role="listitem"
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, paddingRight: spacing.xs, boxShadow: theme.elevation.low }]}
            >
              <Pressable
                role="link"
                accessibilityLabel={`${g.name}, ${books(g.count)}`}
                aria-label={`${g.name}, ${books(g.count)}`}
                onPress={() => router.navigate({ pathname: '/genres/[id]', params: { id: String(g.id) } })}
                testID={Testids.genres.row}
                style={({ pressed }) => [
                  styles.name,
                  { minHeight: sizes.touchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md },
                  pressed && { backgroundColor: colors.surfaceTint },
                ]}
              >
                <Text variant="bodyStrong" numberOfLines={2} style={{ fontFamily: theme.fonts.heading }}>
                  {g.name}
                </Text>
                <Text variant="caption" color="inkMuted">
                  {books(g.count)}
                </Text>
              </Pressable>
              <IconButton
                icon="pencil-outline"
                accessibilityLabel={`Rename ${g.name}`}
                onPress={() => {
                  setName(g.name);
                  setError(null);
                  setPending({ kind: 'rename', genre: g });
                }}
                testID={Testids.genres.rename}
              />
              <IconButton
                icon="call-merge"
                accessibilityLabel={`Merge ${g.name} into another genre`}
                disabled={genres.length < 2}
                onPress={() => setPending({ kind: 'pickMerge', genre: g })}
                testID={Testids.genres.merge}
              />
              <IconButton icon="trash-can-outline" variant="danger" accessibilityLabel={`Delete ${g.name}`} onPress={() => setPending({ kind: 'delete', genre: g })} testID={Testids.genres.delete} />
            </View>
          ))}
        </View>
      )}

      <Sheet
        visible={pending?.kind === 'rename'}
        title={pending?.kind === 'rename' ? `Rename “${pending.genre.name}”` : 'Rename'}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" label="Cancel" onPress={close} disabled={busy} />
            <Button label="Save" onPress={saveRename} loading={busy} testID={Testids.genres.renameSave} />
          </>
        }
      >
        <TextField
          label="Genre name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={saveRename}
          errorText={error ?? undefined}
          testID={Testids.genres.renameInput}
        />
      </Sheet>

      <Sheet
        visible={pending?.kind === 'pickMerge'}
        title={pending?.kind === 'pickMerge' ? `Merge “${pending.genre.name}” into…` : 'Merge into…'}
        subtitle="Its books move to the genre you choose, and it goes away."
        onClose={close}
        footer={<Button variant="secondary" label="Cancel" onPress={close} />}
      >
        <View role="list" style={{ gap: spacing.xs }}>
          {pending?.kind === 'pickMerge'
            ? genres
                .filter((g) => g.id !== pending.genre.id)
                .map((g) => (
                  <Pressable
                    key={g.id}
                    role="button"
                    accessibilityLabel={`${g.name}, ${books(g.count)}`}
                    onPress={() => setPending({ kind: 'confirmMerge', source: pending.genre, target: g, fromRename: false })}
                    testID={Testids.genres.mergeOption}
                    style={({ pressed }) => [
                      styles.option,
                      { minHeight: sizes.touchTarget, paddingHorizontal: spacing.md, borderRadius: radii.md, gap: spacing.md },
                      pressed && { backgroundColor: colors.surfaceTint },
                    ]}
                  >
                    <Text variant="bodyStrong" style={styles.flex}>
                      {g.name}
                    </Text>
                    <Text variant="caption" color="inkMuted">
                      {books(g.count)}
                    </Text>
                  </Pressable>
                ))
            : null}
        </View>
      </Sheet>

      <ConfirmDialog
        visible={pending?.kind === 'confirmMerge'}
        illustration={<Booky expression="thinking" size={72} animated={false} />}
        title={pending?.kind === 'confirmMerge' ? `Merge into “${pending.target.name}”?` : 'Merge?'}
        message={
          pending?.kind === 'confirmMerge'
            ? `${pending.fromRename ? `There’s already a genre called “${pending.target.name}”. ` : ''}Merge “${pending.source.name}” into it? Its ${books(pending.source.count)} will be tagged “${pending.target.name}”.`
            : undefined
        }
        confirmLabel="Merge"
        busy={busy}
        onConfirm={confirmMerge}
        onCancel={close}
      />
      <ConfirmDialog
        visible={pending?.kind === 'delete'}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title={pending?.kind === 'delete' ? `Delete “${pending.genre.name}”?` : 'Delete?'}
        message={pending?.kind === 'delete' ? `The ${books(pending.genre.count)} stay on your shelf; they just lose this genre.` : undefined}
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={close}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  name: { flex: 1, justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
