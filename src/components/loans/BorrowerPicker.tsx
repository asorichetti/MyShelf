import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Text, TextField } from '@/components/ui';
import type { BorrowerWithStats } from '@/db';
import type { Borrower } from '@/domain';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

/** Who a book is being lent to: someone already known, or a new borrower created on save. */
export type BorrowerChoice = { kind: 'existing'; borrower: Borrower } | { kind: 'new'; name: string; contact: string };

export interface BorrowerPickerProps {
  value: BorrowerChoice | null;
  onChange: (choice: BorrowerChoice | null) => void;
  /** Borrowers matching a prefix, most recent first (`loansRepo.searchBorrowers`). */
  search: (prefix: string) => Promise<BorrowerWithStats[]>;
  /** An existing borrower with the same name, ignoring case and accents (`loansRepo.findBorrowerByName`). */
  findByName: (name: string) => Promise<Borrower | null>;
  errorText?: string;
  /** Shown suggestions (the most recent borrowers first). */
  maxSuggestions?: number;
}

export const CONTACT_HELP = 'Phone, email or where they live — just for you.';

function borrowerCaption(b: BorrowerWithStats): string {
  if (b.openLoans > 0) return b.openLoans === 1 ? 'Has 1 book now' : `Has ${b.openLoans} books now`;
  if (b.totalLoans > 0) return b.totalLoans === 1 ? 'Borrowed once before' : `Borrowed ${b.totalLoans} times before`;
  return 'Not borrowed anything yet';
}

/**
 * Picks the borrower in the lend sheet: a search box, recent borrowers first,
 * and "Add “Sam”" to create someone new (with an optional private contact
 * note). Adding a name that already exists asks "Sam already exists — use
 * them?" instead of quietly making a duplicate.
 */
export function BorrowerPicker({ value, onChange, search, findByName, errorText, maxSuggestions = 6 }: BorrowerPickerProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  const [query, setQuery] = useState('');
  const activeQuery = useDebouncedValue(query.trim(), 150);
  const [results, setResults] = useState<BorrowerWithStats[] | null>(null);
  const [duplicate, setDuplicate] = useState<Borrower | null>(null);

  useEffect(() => {
    if (value) return;
    let active = true;
    search(activeQuery)
      .then((list) => active && setResults(list))
      .catch((e) => console.error('Could not search borrowers', e));
    return () => {
      active = false;
    };
  }, [activeQuery, search, value]);

  const name = query.trim();

  const create = async () => {
    const existing = await findByName(name).catch(() => null);
    if (existing) setDuplicate(existing);
    else onChange({ kind: 'new', name, contact: '' });
  };

  if (value) {
    const isNew = value.kind === 'new';
    const shown = isNew ? value.name : value.borrower.name;
    return (
      <View style={{ gap: spacing.md }}>
        <View
          testID={Testids.lend.borrowerSelected}
          style={[styles.selected, { gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceTint, borderColor: colors.primary }]}
        >
          <MaterialCommunityIcons name={isNew ? 'account-plus-outline' : 'account-outline'} size={sizes.icon + 4} color={colors.primary} />
          <View style={styles.flex}>
            <Text variant="caption" color="inkMuted">
              {isNew ? 'New borrower' : 'Lending to'}
            </Text>
            <Text variant="bodyStrong">{shown}</Text>
            {!isNew && value.borrower.contact ? (
              <Text variant="caption" color="inkMuted">
                {value.borrower.contact}
              </Text>
            ) : null}
          </View>
          <Button
            label="Change"
            variant="ghost"
            accessibilityLabel={`Change borrower (now ${shown})`}
            onPress={() => {
              setQuery(shown);
              onChange(null);
            }}
            testID={Testids.lend.borrowerChange}
          />
        </View>
        {isNew ? (
          <TextField
            label={`How to reach ${value.name} (optional)`}
            value={value.contact}
            onChangeText={(contact) => onChange({ ...value, contact })}
            helperText={CONTACT_HELP}
            autoCapitalize="none"
            testID={Testids.lend.borrowerContact}
          />
        ) : null}
      </View>
    );
  }

  const suggestions = (results ?? []).slice(0, maxSuggestions);
  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label="Who’s borrowing it?"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setDuplicate(null);
        }}
        placeholder="A name, like Sam"
        autoCapitalize="words"
        autoComplete="off"
        errorText={errorText}
        helperText={activeQuery ? undefined : results?.length ? 'Pick someone below or type a new name.' : 'Type their name.'}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (name) void create();
        }}
        testID={Testids.lend.borrowerSearch}
      />
      {duplicate ? (
        <View
          role="alert"
          testID={Testids.lend.borrowerExisting}
          style={[{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.warnContainer }]}
        >
          <Text color="onWarnContainer">{`${duplicate.name} already exists — use them?`}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            <Button
              label={`Use ${duplicate.name}`}
              onPress={() => onChange({ kind: 'existing', borrower: duplicate })}
              testID={Testids.lend.borrowerUseExisting}
            />
            <Button
              label="Add someone new"
              variant="secondary"
              accessibilityLabel={`Add a different ${name}`}
              onPress={() => onChange({ kind: 'new', name, contact: '' })}
              testID={Testids.lend.borrowerAddAnyway}
            />
          </View>
        </View>
      ) : null}
      {suggestions.length ? (
        <View style={{ gap: spacing.xs }}>
          {suggestions.map((b) => (
            <Pressable
              key={b.id}
              role="button"
              accessibilityLabel={`Lend to ${b.name}, ${borrowerCaption(b).toLowerCase()}`}
              onPress={() => onChange({ kind: 'existing', borrower: { id: b.id, name: b.name, contact: b.contact } })}
              testID={Testids.lend.borrowerOption}
              style={({ pressed }) => [
                styles.option,
                {
                  minHeight: sizes.touchTarget,
                  gap: spacing.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radii.md,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.surfaceTint : colors.surface,
                },
              ]}
            >
              <MaterialCommunityIcons name="account-outline" size={sizes.icon} color={colors.primary} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{b.name}</Text>
                <Text variant="caption" color="inkMuted">
                  {borrowerCaption(b)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {name && !duplicate ? (
        <Button
          label={`Add “${name}”`}
          variant="secondary"
          accessibilityLabel={`Add ${name} as a new borrower`}
          icon={<MaterialCommunityIcons name="account-plus-outline" size={sizes.icon} color={colors.onPrimaryContainer} />}
          onPress={() => void create()}
          testID={Testids.lend.borrowerCreate}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  selected: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
});
