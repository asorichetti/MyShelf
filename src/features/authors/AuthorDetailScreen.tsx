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
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useAuthor } from './useAuthor';
import { useAuthors } from './useAuthors';

function EditAuthorSheet({ author, onSave, onClose }: { author: Author; onSave: (name: string, sortName: string | null) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(author.name);
  const [sortName, setSortName] = useState(author.sortName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) {
      setError(t('authors.edit.nameRequired'));
      return;
    }
    setBusy(true);
    try {
      await onSave(name.trim(), sortName.trim() || toSortName(name));
      onClose();
    } catch (e) {
      console.error('Could not save the author', e);
      setError(t('common.saveFailed'));
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible
      title={t('authors.edit.title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" label={t('common.cancel')} onPress={onClose} disabled={busy} />
          <Button label={t('common.save')} onPress={save} loading={busy} testID={Testids.authors.editSave} />
        </>
      }
    >
      <TextField label={t('authors.edit.name')} value={name} onChangeText={setName} errorText={error ?? undefined} testID={Testids.authors.editName} />
      <TextField
        label={t('authors.edit.sortName')}
        value={sortName}
        onChangeText={setSortName}
        placeholder={toSortName(name)}
        helperText={t('authors.edit.sortNameHelp')}
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
      title={t('authors.mergeSheet.title', { name: author.name })}
      subtitle={t('authors.mergeSheet.subtitle')}
      onClose={onClose}
      footer={<Button variant="secondary" label={t('common.cancel')} onPress={onClose} />}
    >
      <TextField label={t('authors.mergeSheet.find')} value={query} onChangeText={setQuery} autoCapitalize="none" />
      <View role="list" aria-label={t('authors.mergeSheet.list')} style={{ gap: spacing.xxs }}>
        {others.slice(0, 50).map((a) => (
          <View role="listitem" key={a.id}>
            <Pressable
              role="button"
              accessibilityLabel={t('bookList.nameAndCount', { name: a.name, count: a.count })}
              onPress={() => onPick(a)}
              testID={Testids.authors.mergeOption}
              style={({ pressed }) => [styles.option, { minHeight: sizes.touchTarget, paddingHorizontal: spacing.md, gap: spacing.md, borderRadius: radii.md }, pressed && { backgroundColor: colors.surfaceTint }]}
            >
              <Text variant="bodyStrong" style={styles.flex}>
                {a.name}
              </Text>
              <Text variant="caption" color="inkMuted">
                {t('common.books', { count: a.count })}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
      {others.length === 0 ? <Text color="inkMuted">{t('authors.mergeSheet.none')}</Text> : null}
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
    return <MissingScreen title={t('authors.detail.notFoundTitle')} message={t('authors.detail.notFoundMessage')} fallback="/authors" />;
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
        show({ message: t('authors.detail.merged', { name: kept.name }) });
        router.replace({ pathname: '/authors/[id]', params: { id: String(kept.id) } });
      }
    } catch (e) {
      console.error('Could not merge the authors', e);
      setBusy(false);
      setTarget(null);
      show({ message: t('authors.detail.mergeFailed') });
    }
  };

  return (
    <Screen testID={Testids.authors.detail} edges={['top', 'bottom', 'left', 'right']}>
      <TopBar onBack={() => goBackOr('/authors')}>
        <IconButton icon="pencil-outline" variant="tonal" accessibilityLabel={t('authors.detail.edit', { name: author.name })} onPress={() => setEditing(true)} testID={Testids.authors.edit} />
        <IconButton icon="call-merge" accessibilityLabel={t('authors.detail.merge', { name: author.name })} onPress={() => setMerging(true)} testID={Testids.authors.merge} />
      </TopBar>
      <View style={{ gap: spacing.xs }}>
        <Text variant="stamp" color="accent">
          {t('authors.detail.stamp')}
        </Text>
        <Heading level={1} testID={Testids.authors.detailTitle}>
          {author.name}
        </Heading>
        {author.sortName && author.sortName !== author.name ? (
          <Text variant="mono" color="inkMuted">
            {t('authors.detail.filedUnder', { name: author.sortName })}
          </Text>
        ) : null}
        <Text color="inkMuted">{t('authors.detail.onShelf', { count })}</Text>
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
      {count === 0 ? <Text color="inkMuted">{t('authors.detail.noBooks')}</Text> : null}
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
        title={target ? t('authors.detail.confirmTitle', { name: target.name }) : t('authors.detail.confirmTitleFallback')}
        message={target ? t('authors.detail.confirmMessage', { name: author.name, count, target: target.name }) : undefined}
        confirmLabel={t('common.merge')}
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
