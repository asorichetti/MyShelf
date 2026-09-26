import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GroupEditorSheet, type GroupDraft } from '@/components/groups/GroupEditorSheet';
import { GroupPickerSheet } from '@/components/groups/GroupPickerSheet';
import { Button, Chip, Heading, Text, useSnackbar } from '@/components/ui';
import { groupsRepo, useDatabase } from '@/db';
import type { Group } from '@/domain';
import { useLibraryEvent } from '@/features/events';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useGroups } from './useGroups';

/**
 * The "Groups" part of a book's detail page: a chip per group the book is in
 * (each opens the group) and "Add to group", which picks a group or makes a
 * new one.
 */
export function BookGroupsSection({ bookId, title }: { bookId: number; title: string }) {
  const db = useDatabase();
  const { spacing, sizes, colors } = useTheme();
  const { groups, addBooks, create } = useGroups();
  const { show } = useSnackbar();
  const [memberOf, setMemberOf] = useState<Group[] | null>(null);
  const [version, setVersion] = useState(0);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    groupsRepo
      .listGroupsForBook(db, bookId)
      .then((list) => active && setMemberOf(list))
      .catch((e) => console.error('Could not load the book’s groups', e));
    return () => {
      active = false;
    };
  }, [db, bookId, version]);
  useLibraryEvent(['groups-changed', 'library-changed'], () => setVersion((v) => v + 1));

  const add = async (groupId: number, name: string) => {
    setPicking(false);
    try {
      await addBooks(groupId, [bookId]);
      show({ message: `Added “${title}” to ${name}` });
    } catch (e) {
      console.error('Could not add the book to the group', e);
      show({ message: 'Sorry, I couldn’t add it to that group. Please try again.' });
    }
  };
  const createAndAdd = async (draft: GroupDraft) => {
    const group = await create(draft);
    setCreating(false);
    await add(group.id, group.name);
  };

  if (!memberOf) return null;
  const members = new Set(memberOf.map((g) => g.id));
  return (
    <View style={{ gap: spacing.sm }}>
      <Heading level={2}>Groups</Heading>
      {memberOf.length ? (
        <View testID={Testids.groups.bookChips} style={[styles.chips, { columnGap: spacing.sm }]}>
          {memberOf.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              accessibilityLabel={`Open group ${g.name}`}
              icon="tag-outline"
              onPress={() => router.navigate({ pathname: '/group/[id]', params: { id: String(g.id) } })}
            />
          ))}
        </View>
      ) : (
        <Text color="inkMuted">Not in any of your groups yet.</Text>
      )}
      <Button
        variant="secondary"
        label="Add to group"
        onPress={() => setPicking(true)}
        testID={Testids.groups.bookAdd}
        icon={<MaterialCommunityIcons name="tag-plus-outline" size={sizes.icon} color={colors.onPrimaryContainer} />}
      />
      <GroupPickerSheet
        visible={picking}
        title={`Add “${title}” to a group`}
        groups={groups ?? []}
        disabledIds={members}
        onPick={(id) => add(id, groups?.find((g) => g.id === id)?.name ?? 'the group')}
        onNew={() => {
          setPicking(false);
          setCreating(true);
        }}
        onClose={() => setPicking(false)}
      />
      <GroupEditorSheet visible={creating} onSave={createAndAdd} onCancel={() => setCreating(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
