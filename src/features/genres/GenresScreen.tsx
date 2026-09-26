import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { Button, ConfirmDialog, EmptyState, Heading, IconButton, Screen, Sheet, Text, TextField, TopBar, useSnackbar } from '@/components/ui';
import { GenreNameTakenError, type GenreWithCount } from '@/db';
import { goBackOr } from '@/features/navigation/goBack';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useGenres } from './useGenres';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

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
      setError(t('genres.rename.required'));
      return;
    }
    setBusy(true);
    try {
      await rename(pending.genre.id, clean);
      show({ message: t('genres.rename.done', { name: clean }) });
      close();
    } catch (e) {
      setBusy(false);
      if (e instanceof GenreNameTakenError) {
        setPending({ kind: 'confirmMerge', source: pending.genre, target: e.existing, fromRename: true });
        return;
      }
      console.error('Could not rename the genre', e);
      setError(t('genres.rename.failed'));
    }
  };

  const confirmMerge = async () => {
    if (pending?.kind !== 'confirmMerge') return;
    setBusy(true);
    try {
      const merged = await merge(pending.source.id, pending.target.id);
      show({ message: merged ? t('genres.merge.done', { name: merged.name, count: merged.count }) : t('genres.merge.stale') });
    } catch (e) {
      console.error('Could not merge the genres', e);
      show({ message: t('genres.merge.failed') });
    }
    close();
  };

  const confirmDelete = async () => {
    if (pending?.kind !== 'delete') return;
    setBusy(true);
    try {
      await remove(pending.genre.id);
      show({ message: t('genres.delete.done', { name: pending.genre.name }) });
    } catch (e) {
      console.error('Could not delete the genre', e);
      show({ message: t('genres.delete.failed') });
    }
    close();
  };

  return (
    <Screen testID={Testids.genres.root} edges={[...EDGES]}>
      <TopBar onBack={() => goBackOr('/')} />
      <View style={{ gap: spacing.xs }}>
        <Heading level={1} testID={Testids.genres.title}>
          {t('genres.index.title')}
        </Heading>
        <Text color="inkMuted">{t('genres.index.intro')}</Text>
      </View>
      {genres.length === 0 ? (
        <EmptyState
          testID={Testids.emptyState.root}
          illustration={<Booky expression="sleepy" size={112} />}
          title={t('genres.index.emptyTitle')}
          message={t('genres.index.emptyMessage')}
          action={{ label: t('common.addABook'), onPress: () => router.navigate('/book/new'), variant: 'secondary' }}
        />
      ) : (
        <View role="list" aria-label={t('genres.index.list')} style={{ gap: spacing.sm }}>
          {genres.map((g) => (
            <View
              key={g.id}
              role="listitem"
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, paddingRight: spacing.xs, boxShadow: theme.elevation.low }]}
            >
              <Pressable
                role="link"
                accessibilityLabel={t('bookList.nameAndCount', { name: g.name, count: g.count })}
                aria-label={t('bookList.nameAndCount', { name: g.name, count: g.count })}
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
                  {t('common.books', { count: g.count })}
                </Text>
              </Pressable>
              <IconButton
                icon="pencil-outline"
                accessibilityLabel={t('genres.index.rename', { name: g.name })}
                onPress={() => {
                  setName(g.name);
                  setError(null);
                  setPending({ kind: 'rename', genre: g });
                }}
                testID={Testids.genres.rename}
              />
              <IconButton
                icon="call-merge"
                accessibilityLabel={t('genres.index.merge', { name: g.name })}
                disabled={genres.length < 2}
                onPress={() => setPending({ kind: 'pickMerge', genre: g })}
                testID={Testids.genres.merge}
              />
              <IconButton icon="trash-can-outline" variant="danger" accessibilityLabel={t('genres.index.delete', { name: g.name })} onPress={() => setPending({ kind: 'delete', genre: g })} testID={Testids.genres.delete} />
            </View>
          ))}
        </View>
      )}

      <Sheet
        visible={pending?.kind === 'rename'}
        title={pending?.kind === 'rename' ? t('genres.rename.title', { name: pending.genre.name }) : t('genres.rename.titleFallback')}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" label={t('common.cancel')} onPress={close} disabled={busy} />
            <Button label={t('common.save')} onPress={saveRename} loading={busy} testID={Testids.genres.renameSave} />
          </>
        }
      >
        <TextField
          label={t('genres.rename.field')}
          value={name}
          onChangeText={(text) => {
            setName(text);
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
        title={pending?.kind === 'pickMerge' ? t('genres.merge.title', { name: pending.genre.name }) : t('genres.merge.titleFallback')}
        subtitle={t('genres.merge.subtitle')}
        onClose={close}
        footer={<Button variant="secondary" label={t('common.cancel')} onPress={close} />}
      >
        <View role="list" aria-label={t('genres.merge.list')} style={{ gap: spacing.xs }}>
          {pending?.kind === 'pickMerge'
            ? genres
                .filter((g) => g.id !== pending.genre.id)
                .map((g) => (
                  <View role="listitem" key={g.id}>
                    <Pressable
                      role="button"
                      accessibilityLabel={t('bookList.nameAndCount', { name: g.name, count: g.count })}
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
                        {t('common.books', { count: g.count })}
                      </Text>
                    </Pressable>
                  </View>
                ))
            : null}
        </View>
      </Sheet>

      <ConfirmDialog
        visible={pending?.kind === 'confirmMerge'}
        illustration={<Booky expression="thinking" size={72} animated={false} />}
        title={pending?.kind === 'confirmMerge' ? t('genres.merge.confirmTitle', { name: pending.target.name }) : t('genres.merge.confirmTitleFallback')}
        message={
          pending?.kind === 'confirmMerge'
            ? t(pending.fromRename ? 'genres.merge.confirmMessageTaken' : 'genres.merge.confirmMessage', {
                source: pending.source.name,
                target: pending.target.name,
                count: pending.source.count,
              })
            : undefined
        }
        confirmLabel={t('common.merge')}
        busy={busy}
        onConfirm={confirmMerge}
        onCancel={close}
      />
      <ConfirmDialog
        visible={pending?.kind === 'delete'}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title={pending?.kind === 'delete' ? t('genres.delete.title', { name: pending.genre.name }) : t('genres.delete.titleFallback')}
        message={pending?.kind === 'delete' ? t('genres.delete.message', { count: pending.genre.count }) : undefined}
        confirmLabel={t('common.delete')}
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
