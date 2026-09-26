import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { chunk } from '@/components/book/CoverGrid';
import { Booky, HelpButton } from '@/components/booky';
import { GroupCard } from '@/components/groups/GroupCard';
import { GroupEditorSheet, type GroupDraft } from '@/components/groups/GroupEditorSheet';
import { Button, EmptyState, Heading, Screen, Text, useSnackbar } from '@/components/ui';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useGroups } from './useGroups';

/**
 * The Groups tab: the user's own little shelves ("Favourites", "Signed
 * copies") as cards in a two-column grid, and a button to make a new one.
 */
export function GroupsScreen() {
  const theme = useTheme();
  const { spacing, sizes, colors } = theme;
  const { groups, create } = useGroups();
  const { show } = useSnackbar();
  const [creating, setCreating] = useState(false);
  const openGroup = (id: number) => router.navigate({ pathname: '/group/[id]', params: { id: String(id) } });

  const save = async (draft: GroupDraft) => {
    const group = await create(draft);
    setCreating(false);
    show({ message: t('groups.screen.created', { name: group.name }) });
  };

  return (
    <Screen testID={Testids.groups.root} pageState={groups ? 'content' : 'loading'}>
      <View style={[styles.header, { gap: spacing.md }]}>
        <View style={[styles.flex, { gap: spacing.xs }]}>
          <View style={[styles.titleRow, { gap: spacing.sm }]}>
            <Heading level={1} testID={Testids.groups.title} style={styles.grow}>
              {t('groups.screen.title')}
            </Heading>
            <HelpButton screen="groups" />
          </View>
          <Text color="inkMuted">{t('groups.screen.intro')}</Text>
        </View>
        {groups?.length ? (
          <Button
            label={t('groups.screen.newGroup')}
            onPress={() => setCreating(true)}
            testID={Testids.groups.new}
            icon={<MaterialCommunityIcons name="plus" size={sizes.icon} color={colors.onPrimary} />}
          />
        ) : null}
      </View>
      {groups && groups.length === 0 ? (
        <EmptyState
          testID={Testids.emptyState.root}
          illustration={<Booky expression="happy" size={112} />}
          title={t('groups.screen.emptyTitle')}
          message={t('groups.screen.emptyMessage')}
          action={{ label: t('groups.screen.newGroup'), onPress: () => setCreating(true), testID: Testids.groups.new }}
        />
      ) : null}
      {groups?.length ? (
        <View role="list" aria-label={t('groups.screen.listLabel')} style={{ gap: spacing.md }}>
          {chunk(groups, 2).map((pair) => (
            <View key={pair.map((g) => g.id).join('-')} style={[styles.row, { gap: spacing.md }]}>
              {pair.map((g) => (
                <View key={g.id} role="listitem" style={styles.cell}>
                  <GroupCard group={g} onPress={openGroup} />
                </View>
              ))}
              {pair.length === 1 ? <View style={styles.cell} /> : null}
            </View>
          ))}
        </View>
      ) : null}
      <GroupEditorSheet visible={creating} onSave={save} onCancel={() => setCreating(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 180 },
  row: { flexDirection: 'row' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  cell: { flex: 1, minWidth: 0 },
});
