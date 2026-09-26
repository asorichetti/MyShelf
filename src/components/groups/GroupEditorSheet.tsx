import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Heading, Sheet, Text, TextField } from '@/components/ui';
import { DEFAULT_GROUP_ICON, groupIconLabels, groupIconOf, groupIcons, GROUP_NAME_MAX, validateGroupName, type GroupIcon } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { DEFAULT_GROUP_SWATCH, groupSwatch, groupSwatchesFor, useTheme } from '@/theme';

import { groupIconNames } from './groupIconNames';

export interface GroupDraft {
  name: string;
  colour: string;
  icon: GroupIcon;
}

export interface GroupEditorSheetProps {
  visible: boolean;
  /** The group being edited; omitted for a new one. */
  initial?: { name: string; colour: string | null; icon: string | null } | null;
  /** Saves; a rejected promise keeps the sheet open with an error. */
  onSave: (draft: GroupDraft) => Promise<void> | void;
  onCancel: () => void;
}

/**
 * The sheet for making or editing a group: a name, one of eight colour
 * swatches ("Lavender") and one of eight icons ("Heart icon"). Swatches and
 * icons are radio buttons with 48 dp targets.
 */
export function GroupEditorSheet(props: GroupEditorSheetProps) {
  // Mounted only while open, so each opening starts from the group (or a blank one).
  return props.visible ? <OpenGroupEditor {...props} /> : null;
}

function OpenGroupEditor({ visible, initial, onSave, onCancel }: GroupEditorSheetProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const [name, setName] = useState(initial?.name ?? '');
  const [colour, setColour] = useState(groupSwatch(initial?.colour ?? DEFAULT_GROUP_SWATCH).name);
  const [icon, setIcon] = useState<GroupIcon>(groupIconOf(initial?.icon ?? DEFAULT_GROUP_ICON));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const problem = validateGroupName(name);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), colour, icon });
    } catch (e) {
      console.error('Could not save the group', e);
      setError('Sorry, I couldn’t save that group. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const swatch = groupSwatch(colour, theme.scheme);
  return (
    <Sheet
      visible={visible}
      title={initial ? 'Edit group' : 'New group'}
      subtitle={initial ? undefined : 'A little shelf of your own, like “Favourites” or “Signed copies”.'}
      onClose={onCancel}
      testID={Testids.groups.editorSheet}
      footer={
        <>
          <Button variant="secondary" label="Cancel" onPress={onCancel} disabled={saving} testID={Testids.groups.editorCancel} />
          <Button label={initial ? 'Save' : 'Create group'} onPress={save} loading={saving} testID={Testids.groups.editorSave} />
        </>
      }
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (error) setError(null);
        }}
        maxLength={GROUP_NAME_MAX}
        placeholder="Favourites"
        autoFocus={!initial}
        returnKeyType="done"
        onSubmitEditing={save}
        errorText={error ?? undefined}
        testID={Testids.groups.editorName}
      />
      <View style={{ gap: spacing.xs }}>
        <Heading level={3}>Colour</Heading>
        <View role="radiogroup" aria-label="Colour" style={[styles.wrap, { gap: spacing.xs }]}>
          {groupSwatchesFor(theme.scheme).map((s) => {
            const selected = s.name === colour;
            return (
              <Pressable
                key={s.name}
                role="radio"
                accessibilityLabel={s.label}
                aria-checked={selected}
                accessibilityState={{ checked: selected }}
                onPress={() => setColour(s.name)}
                testID={Testids.groups.editorSwatch}
                style={[styles.option, { width: sizes.touchTarget, height: sizes.touchTarget, borderRadius: radii.pill, borderColor: selected ? colors.primary : 'transparent' }]}
              >
                <View style={[styles.dot, { width: sizes.iconButton, height: sizes.iconButton, backgroundColor: s.band, borderColor: colors.outline, borderRadius: radii.pill }]}>
                  {selected ? <MaterialCommunityIcons name="check" size={sizes.icon} color={s.onBand} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Heading level={3}>Icon</Heading>
        <View role="radiogroup" aria-label="Icon" style={[styles.wrap, { gap: spacing.xs }]}>
          {groupIcons.map((id) => {
            const selected = id === icon;
            return (
              <Pressable
                key={id}
                role="radio"
                accessibilityLabel={`${groupIconLabels[id]} icon`}
                aria-checked={selected}
                accessibilityState={{ checked: selected }}
                onPress={() => setIcon(id)}
                testID={Testids.groups.editorIcon}
                style={[
                  styles.option,
                  {
                    width: sizes.touchTarget,
                    height: sizes.touchTarget,
                    borderRadius: radii.md,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? swatch.band : colors.surface,
                  },
                ]}
              >
                <MaterialCommunityIcons name={groupIconNames[id]} size={sizes.icon + 4} color={selected ? swatch.onBand : colors.inkMuted} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View
        aria-hidden
        style={[styles.preview, { backgroundColor: swatch.band, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }]}
      >
        <MaterialCommunityIcons name={groupIconNames[icon]} size={sizes.icon} color={swatch.onBand} />
        <Text variant="bodyStrong" numberOfLines={1} style={{ color: swatch.onBand, fontFamily: theme.fonts.heading, flex: 1 }}>
          {name.trim() || 'Your group'}
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  option: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  dot: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  preview: { flexDirection: 'row', alignItems: 'center' },
});
