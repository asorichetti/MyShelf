import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { focusWithin } from '@/components/groups/focusWithin';
import { Button, Chip, Heading, IconButton, Sheet, Text, TextField } from '@/components/ui';
import {
  addSavedPreset,
  applyPreset,
  deleteSavedPreset,
  flipLevel,
  groupByLabels,
  MAX_PRESET_NAME,
  MAX_SORT_LEVELS,
  moveLevel,
  newPresetId,
  newSeed,
  presetNameProblem,
  removeLevel,
  renameSavedPreset,
  sameLevels,
  sectionSort,
  sortPresets,
  type PresetNameProblem,
  type SavedSortPreset,
  type ShelfGroupBy,
  type ShelfSort,
  type SortKeyId,
  type SortKeyInfo,
  type SortLevel,
} from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

const T = Testids.sortSheet;

export interface SortSheetProps {
  visible: boolean;
  /** Every key there is, in the order offered (the registry's `sortKeyList`). */
  keys: readonly SortKeyInfo[];
  /** The sort in words ("Genre, then Author"); `groupBy` marks a first level that orders the sections. */
  describe: (levels: readonly SortLevel[], groupBy?: ShelfGroupBy) => string;
  sort: ShelfSort;
  groupBy: ShelfGroupBy;
  presets: readonly SavedSortPreset[];
  onChange: (sort: ShelfSort) => void;
  onPresetsChange: (presets: SavedSortPreset[]) => void;
  onClose: () => void;
}

const nameProblems: Record<PresetNameProblem, string> = {
  empty: 'Give it a name.',
  tooLong: `Keep it under ${MAX_PRESET_NAME + 1} characters.`,
  taken: 'You already have a preset with that name.',
  full: 'That’s as many presets as I can keep. Delete one first.',
};

const levelName = (index: number) => (index === 0 ? 'Sort by' : 'Then by');

/**
 * The Shelf's Sort sheet (P11-03): preset chips at the top, the user's saved
 * presets (apply, rename, delete), then the levels — "Sort by", "Then by…" —
 * each with its key, a direction button that says what it means ("A to Z",
 * "Newest first"), and move up, move down and remove buttons, so the whole
 * sort can be built with a keyboard or a screen reader. Changes apply at
 * once; "Save as preset" names the current sort.
 */
export function SortSheet(props: SortSheetProps) {
  // Mounted only while open, so pickers and the name field start closed each time.
  return props.visible ? <OpenSortSheet {...props} /> : null;
}

function OpenSortSheet({ visible, keys, describe, sort, groupBy, presets, onChange, onPresetsChange, onClose }: SortSheetProps) {
  const { spacing, colors, radii, sizes } = useTheme();
  const byId = Object.fromEntries(keys.map((k) => [k.id, k])) as Record<SortKeyId, SortKeyInfo>;
  const directionLabel = (level: SortLevel) => byId[level.key].directionLabels[level.direction];
  const { levels } = sort;
  const [picking, setPicking] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [naming, setNaming] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const rows = useRef(new Map<string, unknown>());
  const { skipped } = sectionSort(levels, groupBy);

  const setLevels = (next: SortLevel[]) => onChange(next.some((l) => l.key === 'shuffle') ? { levels: next, seed: sort.seed ?? newSeed() } : { levels: next });

  /** Focus the first enabled button in a level row (or the named one) once it has re-rendered. */
  const focusRow = (key: SortKeyId, which?: 'up' | 'down') =>
    requestAnimationFrame(() => focusWithin(rows.current.get(which ? `${key}:${which}` : key)));

  const move = (index: number, by: -1 | 1) => {
    const level = levels[index];
    const to = index + by;
    setLevels(moveLevel(levels, index, by));
    setAnnouncement(`${byId[level.key].label} moved to level ${to + 1} of ${levels.length}`);
    // Keep focus with the level; at an end the other arrow is the useful one.
    const atEnd = to === 0 || to === levels.length - 1;
    focusRow(level.key, atEnd ? (by < 0 ? 'down' : 'up') : by < 0 ? 'up' : 'down');
  };

  const remove = (index: number) => {
    const label = byId[levels[index].key].label;
    const next = removeLevel(levels, index);
    setLevels(next);
    setPicking(null);
    setAnnouncement(`Removed ${label}`);
    const neighbour = next[Math.min(index, next.length - 1)];
    focusRow(neighbour.key);
  };

  const add = () => {
    const used = new Set(levels.map((l) => l.key));
    const def = keys.find((d) => !used.has(d.id) && d.id !== 'shuffle');
    if (!def || levels.length >= MAX_SORT_LEVELS) return;
    setLevels([...levels, { key: def.id, direction: def.defaultDirection }]);
    setPicking(levels.length);
    setAnnouncement(`Added level ${levels.length + 1}: ${def.label}. Choose what to sort by.`);
    focusRow(def.id);
  };

  const choose = (index: number, key: SortKeyId) => {
    const def = byId[key];
    setLevels(levels.map((l, i) => (i === index ? { key, direction: def.defaultDirection } : l)));
    setPicking(null);
    setAnnouncement(`${levelName(index)} ${def.label}, ${def.directionLabels[def.defaultDirection]}`);
    focusRow(key);
  };

  const flip = (index: number) => {
    const next = flipLevel(levels, index);
    setLevels(next);
    setAnnouncement(`${byId[next[index].key].label}: ${directionLabel(next[index])}`);
  };

  const savePreset = () => {
    if (naming == null) return;
    const problem = presetNameProblem(naming, presets);
    if (problem) {
      setNameError(nameProblems[problem]);
      return;
    }
    onPresetsChange(addSavedPreset(presets, naming, levels, newPresetId(presets)));
    setAnnouncement(`Saved “${naming.trim()}”`);
    setNaming(null);
    setNameError(null);
  };

  const saveRename = () => {
    if (!renaming) return;
    const problem = presetNameProblem(renaming.name, presets, renaming.id);
    if (problem) {
      setRenameError(nameProblems[problem]);
      return;
    }
    onPresetsChange(renameSavedPreset(presets, renaming.id, renaming.name));
    setAnnouncement(`Renamed to “${renaming.name.trim()}”`);
    setRenaming(null);
    setRenameError(null);
  };

  const shuffles = levels.some((l) => l.key === 'shuffle');
  const matchesSaved = presets.some((p) => sameLevels(p.levels, levels));

  return (
    <Sheet
      visible={visible}
      title="Sort your shelf"
      subtitle={describe(levels, groupBy)}
      onClose={onClose}
      testID={T.root}
      footer={<Button label="Done" onPress={onClose} testID={T.done} />}
    >
      <Text role="status" aria-live="polite" accessibilityLiveRegion="polite" variant="caption" color="inkMuted" testID={T.status}>
        {announcement || ' '}
      </Text>

      <View role="radiogroup" aria-label="Presets" style={{ gap: spacing.xs }}>
        <Heading level={3}>Presets</Heading>
        <View style={[styles.wrap, { columnGap: spacing.sm }]}>
          {sortPresets.map((p) => (
            <Chip
              key={p.id}
              role="radio"
              label={p.name}
              selected={sameLevels(p.levels, levels)}
              onPress={() => {
                onChange(applyPreset(p.levels));
                setAnnouncement(p.id === 'surprise' ? 'Shuffled' : `Sorted by ${p.name}`);
              }}
              testID={T.preset}
            />
          ))}
        </View>
        {shuffles ? (
          <Button
            variant="secondary"
            label="Shuffle again"
            icon={<MaterialCommunityIcons name="shuffle-variant" size={sizes.icon} color={colors.onPrimaryContainer} />}
            onPress={() => {
              onChange({ levels, seed: newSeed() });
              setAnnouncement('Shuffled again');
            }}
            testID={T.reshuffle}
            style={{ alignSelf: 'flex-start' }}
          />
        ) : null}
      </View>

      {presets.length ? (
        <View role="group" aria-label="Your presets" style={{ gap: spacing.xs }}>
          <Heading level={3}>Your presets</Heading>
          {presets.map((p) =>
            renaming?.id === p.id ? (
              <View key={p.id} style={{ gap: spacing.xs }}>
                <TextField
                  label={`New name for ${p.name}`}
                  value={renaming.name}
                  onChangeText={(name) => setRenaming({ id: p.id, name })}
                  maxLength={MAX_PRESET_NAME}
                  errorText={renameError ?? undefined}
                  onSubmitEditing={saveRename}
                  autoFocus
                  testID={T.renameField}
                />
                <View style={[styles.row, { gap: spacing.sm }]}>
                  <Button variant="ghost" label="Cancel" onPress={() => { setRenaming(null); setRenameError(null); }} testID={T.renameCancel} />
                  <Button variant="secondary" label="Rename" onPress={saveRename} testID={T.renameSave} />
                </View>
              </View>
            ) : (
              <View key={p.id} style={[styles.row, { gap: spacing.xxs }]}>
                <View style={styles.fill}>
                  <Chip
                    label={p.name}
                    accessibilityLabel={`${p.name}: ${describe(p.levels)}`}
                    selected={sameLevels(p.levels, levels)}
                    onPress={() => {
                      onChange(applyPreset(p.levels));
                      setAnnouncement(`Sorted by ${p.name}`);
                    }}
                    testID={T.savedPreset}
                  />
                </View>
                <IconButton icon="pencil-outline" accessibilityLabel={`Rename ${p.name}`} onPress={() => setRenaming({ id: p.id, name: p.name })} testID={T.savedRename} />
                <IconButton
                  icon="delete-outline"
                  variant="danger"
                  accessibilityLabel={`Delete ${p.name}`}
                  onPress={() => {
                    onPresetsChange(deleteSavedPreset(presets, p.id));
                    setAnnouncement(`Deleted “${p.name}”`);
                  }}
                  testID={T.savedDelete}
                />
              </View>
            ),
          )}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Heading level={3}>Your sort</Heading>
        {skipped ? (
          <Text variant="caption" color="inkMuted" testID={T.groupNote}>
            {`Grouped by ${groupByLabels[groupBy].toLowerCase()}: ${byId[skipped.key].label} orders the sections, so inside them the next level decides.`}
          </Text>
        ) : null}
        <View role="list" aria-label="Sort levels" style={{ gap: spacing.sm }}>
          {levels.map((level, index) => {
            const def = byId[level.key];
            const open = picking === index;
            const used = new Set(levels.filter((_, i) => i !== index).map((l) => l.key));
            return (
              <View
                key={level.key}
                ref={(el) => void rows.current.set(level.key, el)}
                role="listitem"
                aria-label={`Level ${index + 1}: ${levelName(index)} ${def.label}, ${directionLabel(level)}`}
                testID={T.level}
                style={[styles.level, { gap: spacing.xs, padding: spacing.sm, borderRadius: radii.md, borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Text variant="label" color="inkMuted">
                  {`${index + 1}. ${levelName(index)}`}
                </Text>
                <View style={[styles.row, styles.wrap, { gap: spacing.xs }]}>
                  <Button
                    variant="secondary"
                    label={def.label}
                    accessibilityLabel={`${levelName(index)}: ${def.label}. Change`}
                    icon={<MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={sizes.icon} color={colors.onPrimaryContainer} />}
                    expanded={open}
                    onPress={() => setPicking(open ? null : index)}
                    testID={T.levelKey}
                  />
                  {def.fixedDirection ? null : (
                    <Button
                      variant="ghost"
                      label={directionLabel(level)}
                      accessibilityLabel={`${def.label} order: ${directionLabel(level)}. Reverse`}
                      icon={<MaterialCommunityIcons name="swap-vertical" size={sizes.icon} color={colors.primary} />}
                      onPress={() => flip(index)}
                      testID={T.levelDirection}
                    />
                  )}
                  <View style={[styles.row, styles.push]}>
                    <View ref={(el) => void rows.current.set(`${level.key}:up`, el)}>
                      <IconButton icon="arrow-up" accessibilityLabel={`Move ${def.label} up`} disabled={index === 0} onPress={() => move(index, -1)} testID={T.levelUp} />
                    </View>
                    <View ref={(el) => void rows.current.set(`${level.key}:down`, el)}>
                      <IconButton
                        icon="arrow-down"
                        accessibilityLabel={`Move ${def.label} down`}
                        disabled={index === levels.length - 1}
                        onPress={() => move(index, 1)}
                        testID={T.levelDown}
                      />
                    </View>
                    <IconButton icon="close" accessibilityLabel={`Remove ${def.label}`} disabled={levels.length <= 1} onPress={() => remove(index)} testID={T.levelRemove} />
                  </View>
                </View>
                <Text variant="caption" color="inkMuted">
                  {def.hint}
                </Text>
                {open ? (
                  <View role="radiogroup" aria-label={`${levelName(index)}: choose a key`} style={[styles.wrap, { columnGap: spacing.sm }]}>
                    {keys
                      .filter((d) => !used.has(d.id))
                      .map((d) => (
                        <Chip key={d.id} role="radio" label={d.label} selected={d.id === level.key} onPress={() => choose(index, d.id)} testID={T.levelKeyOption} />
                      ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <Text variant="caption" color="inkMuted">
          Books still tied after the last level go by title.
        </Text>
        <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
          <Button
            variant="secondary"
            label="Add a level"
            accessibilityLabel={levels.length >= MAX_SORT_LEVELS ? `Add a level (at most ${MAX_SORT_LEVELS})` : 'Add a level'}
            icon={<MaterialCommunityIcons name="plus" size={sizes.icon} color={colors.onPrimaryContainer} />}
            disabled={levels.length >= MAX_SORT_LEVELS}
            onPress={add}
            testID={T.addLevel}
          />
          {naming == null ? (
            <Button
              variant="ghost"
              label="Save as preset"
              icon={<MaterialCommunityIcons name="content-save-outline" size={sizes.icon} color={colors.primary} />}
              disabled={matchesSaved || sortPresets.some((p) => sameLevels(p.levels, levels))}
              onPress={() => setNaming('')}
              testID={T.savePreset}
            />
          ) : null}
        </View>
        {naming != null ? (
          <View style={{ gap: spacing.xs }}>
            <TextField
              label="Preset name"
              value={naming}
              onChangeText={(t) => {
                setNaming(t);
                setNameError(null);
              }}
              maxLength={MAX_PRESET_NAME}
              placeholder="e.g. Reading pile"
              errorText={nameError ?? undefined}
              helperText={describe(levels)}
              onSubmitEditing={savePreset}
              autoFocus
              testID={T.presetName}
            />
            <View style={[styles.row, { gap: spacing.sm }]}>
              <Button variant="ghost" label="Cancel" onPress={() => { setNaming(null); setNameError(null); }} testID={T.presetCancel} />
              <Button variant="secondary" label="Save preset" onPress={savePreset} testID={T.presetSave} />
            </View>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  fill: { flex: 1 },
  push: { marginLeft: 'auto' },
  level: { borderWidth: 1 },
});
