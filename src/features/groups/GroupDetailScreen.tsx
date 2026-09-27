import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookRow } from '@/components/book/BookRow';
import { SelectionBar } from '@/components/book/SelectionBar';
import { Booky } from '@/components/booky';
import { GroupEditorSheet, type GroupDraft } from '@/components/groups/GroupEditorSheet';
import { groupIconName } from '@/components/groups/groupIconNames';
import { ReorderList } from '@/components/groups/ReorderList';
import { Button, ConfirmDialog, EmptyState, Heading, IconButton, Screen, Text, TopBar, useSnackbar } from '@/components/ui';
import { goBackOr } from '@/features/navigation/goBack';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { MissingScreen } from '@/features/navigation/MissingScreen';
import { parseId } from '@/features/navigation/parseId';
import { useSelection } from '@/features/shelf/useSelection';
import { useMounted } from '@/hooks/useMounted';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { groupSwatch, useTheme } from '@/theme';

import { useGroup } from './useGroup';
import { useGroups } from './useGroups';

const books = (n: number) => t('common.books', { count: n });

/**
 * `/group/[id]`: a group's books in the group's own order. "Reorder" swaps
 * the list for move-up/move-down buttons; "Add books" opens the Shelf to pick
 * books; selecting books offers "Remove from group". Edit and delete the
 * group from the top bar.
 */
export function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = parseId(id);
  const { state, move, removeBooks } = useGroup(groupId);
  const { update, remove } = useGroups();
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const { show } = useSnackbar();
  const mounted = useMounted();
  const selection = useSelection();
  const [reordering, setReordering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { selecting, toggle, start, isSelected } = selection;
  const onPress = useCallback(
    (bookId: number) => (selecting ? toggle(bookId) : router.navigate({ pathname: '/book/[id]', params: { id: String(bookId) } })),
    [selecting, toggle],
  );

  if (state.status === 'loading') return <LoadingPage />;
  if (state.status === 'missing') {
    return <MissingScreen title={t('groups.detail.notFoundTitle')} message={t('groups.detail.notFoundMessage')} fallback="/groups" />;
  }
  const { group, items } = state;
  const swatch = groupSwatch(group.colour, theme.scheme);

  const save = async (draft: GroupDraft) => {
    await update(group.id, draft);
    setEditing(false);
  };

  const removeSelected = async () => {
    const removed = await removeBooks(selection.ids);
    selection.exit();
    show({ message: t('groups.detail.removed', { books: books(removed), name: group.name }) });
  };

  const deleteGroup = async () => {
    await remove(group.id);
    show({ message: t('groups.detail.deleted', { name: group.name }) });
    if (!mounted.current) return;
    setConfirmingDelete(false);
    goBackOr('/groups');
  };

  return (
    <Screen testID={Testids.groups.detail} edges={['top', 'bottom', 'left', 'right']}>
      <TopBar onBack={() => goBackOr('/groups')}>
        <IconButton icon="pencil-outline" variant="tonal" accessibilityLabel={t('groups.detail.edit', { name: group.name })} onPress={() => setEditing(true)} testID={Testids.groups.edit} />
        <IconButton icon="trash-can-outline" variant="danger" accessibilityLabel={t('groups.detail.delete', { name: group.name })} onPress={() => setConfirmingDelete(true)} testID={Testids.groups.delete} />
      </TopBar>
      <View style={[styles.band, { backgroundColor: swatch.band, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }]}>
        <MaterialCommunityIcons name={groupIconName(group.icon)} size={sizes.icon * 1.6} color={swatch.onBand} />
        <View style={[styles.flex, { gap: spacing.xxs }]}>
          <Heading level={1} testID={Testids.groups.detailTitle} style={{ color: swatch.onBand }}>
            {group.name}
          </Heading>
          <Text variant="stamp" style={{ color: swatch.onBand }}>
            {books(items.length)}
          </Text>
        </View>
      </View>
      {items.length ? (
        <View style={[styles.actions, { gap: spacing.sm }]}>
          <Button
            variant={reordering ? 'primary' : 'secondary'}
            label={reordering ? t('common.done') : t('groups.detail.reorder')}
            accessibilityLabel={reordering ? t('groups.detail.doneReorderingLabel') : t('groups.detail.reorderLabel')}
            onPress={() => {
              selection.exit();
              setReordering((r) => !r);
            }}
            testID={reordering ? Testids.groups.reorderDone : Testids.groups.reorder}
            icon={<MaterialCommunityIcons name={reordering ? 'check' : 'swap-vertical'} size={sizes.icon} color={reordering ? colors.onPrimary : colors.onPrimaryContainer} />}
          />
          {reordering ? null : (
            <>
              <Button
                variant="secondary"
                label={t('groups.detail.addBooks')}
                onPress={() => router.push({ pathname: '/', params: { addTo: String(group.id) } })}
                testID={Testids.groups.addBooks}
                icon={<MaterialCommunityIcons name="book-plus-outline" size={sizes.icon} color={colors.onPrimaryContainer} />}
              />
              {selecting ? null : <Button variant="ghost" label={t('groups.detail.select')} accessibilityLabel={t('groups.detail.selectLabel')} onPress={() => start()} testID={Testids.shelfView.selectButton} />}
            </>
          )}
        </View>
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          testID={Testids.emptyState.root}
          illustration={<Booky expression="happy" size={96} />}
          title={t('groups.detail.emptyTitle')}
          message={t('groups.detail.emptyMessage')}
          action={{ label: t('groups.detail.addBooks'), onPress: () => router.push({ pathname: '/', params: { addTo: String(group.id) } }), testID: Testids.groups.addBooks }}
        />
      ) : reordering ? (
        <ReorderList items={items} onMove={move} />
      ) : (
        <View role="list" aria-label={t('groups.detail.listLabel', { name: group.name })} style={{ gap: spacing.md, paddingBottom: selecting ? sizes.touchTarget * 3 : 0 }}>
          {items.map((item) => (
            <View key={item.id} role="listitem">
              <BookRow item={item} onPress={onPress} onLongPress={start} selected={selecting ? isSelected(item.id) : undefined} />
            </View>
          ))}
        </View>
      )}
      {selecting ? (
        <SelectionBar
          count={selection.count}
          onCancel={selection.exit}
          onRemoveFromGroup={removeSelected}
          style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md }}
        />
      ) : null}
      <GroupEditorSheet visible={editing} initial={group} onSave={save} onCancel={() => setEditing(false)} />
      <ConfirmDialog
        visible={confirmingDelete}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title={t('groups.detail.deleteTitle', { name: group.name })}
        message={t('groups.detail.deleteMessage')}
        confirmLabel={t('groups.detail.deleteConfirm')}
        destructive
        onConfirm={deleteGroup}
        onCancel={() => setConfirmingDelete(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});
