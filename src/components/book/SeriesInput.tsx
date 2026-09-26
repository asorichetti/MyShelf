import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { Button, Chip, Text, TextField } from '@/components/ui';
import { formatSeriesLabel, formatSeriesPosition, isValidSeriesPosition, normaliseText, parseSeriesPosition } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

/** A series already in the library, as the picker lists it. */
export interface SeriesOption {
  id: number;
  name: string;
  bookCount: number;
}

/** A series the metadata suggested for this book (P02-08), e.g. Discworld #5. */
export interface SeriesSuggestion {
  name: string;
  position: number | null;
}

export interface SeriesInputProps {
  /** The series name as typed or picked ('' for none). */
  name: string;
  /** The position as typed ('' for none): 3, 2.5, III, "Book 3"… */
  position: string;
  onNameChange: (name: string) => void;
  onPositionChange: (position: string) => void;
  existing: readonly SeriesOption[];
  /** Shows a "Suggested: Discworld #5" chip; tapping it fills both fields. */
  suggestion?: SeriesSuggestion | null;
  nameError?: string;
  positionError?: string;
  nameRef?: Ref<TextInput>;
  positionRef?: Ref<TextInput>;
}

const MAX_OPTIONS = 5;
const books = (count: number) => t('common.books', { count });

/** Existing series whose name contains the typed text (ignoring case, accents and a leading "The"). */
export function matchingSeries(existing: readonly SeriesOption[], typed: string): { exact: SeriesOption | null; options: SeriesOption[] } {
  const key = normaliseText(typed);
  if (!key) return { exact: null, options: [] };
  const exact = existing.find((s) => normaliseText(s.name) === key) ?? null;
  const options = existing
    .filter((s) => s !== exact && normaliseText(s.name).includes(key))
    .sort((a, b) => Number(!normaliseText(b.name).startsWith(key)) - Number(!normaliseText(a.name).startsWith(key)) || a.name.localeCompare(b.name))
    .slice(0, MAX_OPTIONS);
  return { exact, options };
}

/**
 * The book form's series picker (P04-02): type to search the series already
 * in the library or start a new one, the book's number in it (3, 2.5 or
 * III), a "Not part of a series" clear action and, when the book came from a
 * lookup with a series hint, a "Suggested: Discworld #5" chip.
 */
export function SeriesInput({
  name,
  position,
  onNameChange,
  onPositionChange,
  existing,
  suggestion,
  nameError,
  positionError,
  nameRef,
  positionRef,
}: SeriesInputProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  // The list opens while typing and closes once a series is picked or created.
  const [searching, setSearching] = useState(false);
  const typed = name.trim();
  const { exact, options } = matchingSeries(existing, typed);
  const showList = searching && typed !== '' && !exact;

  const parsed = parseSeriesPosition(position);
  const positionOk = isValidSeriesPosition(parsed);
  const positionHelper = !position.trim()
    ? t('bookForm.series.numberHelp')
    : positionOk
      ? t('bookForm.series.savesAs', { position: formatSeriesPosition(parsed) })
      : t('bookForm.series.numberInvalid');

  const suggestionApplied =
    suggestion != null &&
    normaliseText(suggestion.name) === normaliseText(name) &&
    formatSeriesPosition(suggestion.position) === (positionOk ? formatSeriesPosition(parsed) : position.trim());
  const suggestionLabel = suggestion ? formatSeriesLabel(suggestion.name, suggestion.position) : '';

  const pick = (option: SeriesOption) => {
    onNameChange(option.name);
    setSearching(false);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {suggestion && !suggestionApplied ? (
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Chip
            label={t('bookForm.series.suggested', { series: suggestionLabel })}
            icon="lightbulb-on-outline"
            accessibilityLabel={t('bookForm.series.useSuggested', { series: suggestionLabel })}
            onPress={() => {
              const known = matchingSeries(existing, suggestion.name).exact;
              onNameChange(known?.name ?? suggestion.name);
              onPositionChange(formatSeriesPosition(suggestion.position));
              setSearching(false);
            }}
            testID={Testids.seriesInput.suggestion}
          />
        </View>
      ) : null}
      <View style={[styles.pair, { gap: spacing.md }]}>
        <View style={styles.wide}>
          <TextField
            ref={nameRef}
            label={t('bookFields.series')}
            value={name}
            onChangeText={(v) => {
              onNameChange(v);
              setSearching(true);
            }}
            placeholder={t('bookForm.series.namePlaceholder')}
            autoCapitalize="words"
            autoCorrect={false}
            errorText={nameError}
            testID={Testids.seriesInput.search}
          />
        </View>
        <View style={styles.narrow}>
          <TextField
            ref={positionRef}
            label={t('bookForm.series.number')}
            value={position}
            onChangeText={onPositionChange}
            placeholder={t('bookForm.series.numberPlaceholder')}
            helperText={positionHelper}
            errorText={positionError}
            autoCorrect={false}
            autoCapitalize="characters"
            maxLength={16}
            testID={Testids.seriesInput.position}
          />
        </View>
      </View>

      {typed ? (
        <View style={[styles.row, { gap: spacing.xs }]} testID={Testids.seriesInput.status}>
          <MaterialCommunityIcons
            name={exact ? 'bookshelf' : 'plus-circle-outline'}
            size={sizes.icon}
            color={colors.inkMuted}
            aria-hidden
          />
          <Text variant="caption" color="inkMuted" style={styles.flex}>
            {exact ? t('bookForm.series.inLibrary', { books: books(exact.bookCount) }) : t('bookForm.series.newSeries')}
          </Text>
        </View>
      ) : null}

      {showList ? (
        <View aria-label={t('bookForm.series.list')} style={[styles.list, { borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface }]}>
          {options.map((option) => (
            <Pressable
              key={option.id}
              role="button"
              accessibilityLabel={t('bookForm.series.option', { name: option.name, books: books(option.bookCount) })}
              onPress={() => pick(option)}
              testID={Testids.seriesInput.option}
              style={({ pressed }) => [styles.option, { minHeight: sizes.touchTarget, paddingHorizontal: spacing.md, gap: spacing.sm }, pressed && { backgroundColor: colors.surfaceTint }]}
            >
              <Text style={styles.flex} numberOfLines={1}>
                {option.name}
              </Text>
              <Text variant="caption" color="inkMuted">
                {books(option.bookCount)}
              </Text>
            </Pressable>
          ))}
          <Pressable
            role="button"
            accessibilityLabel={t('bookForm.series.createLabel', { name: typed })}
            onPress={() => {
              onNameChange(typed);
              setSearching(false);
            }}
            testID={Testids.seriesInput.create}
            style={({ pressed }) => [
              styles.option,
              { minHeight: sizes.touchTarget, paddingHorizontal: spacing.md, gap: spacing.sm, borderTopColor: colors.border },
              options.length > 0 && styles.divider,
              pressed && { backgroundColor: colors.surfaceTint },
            ]}
          >
            <MaterialCommunityIcons name="plus" size={sizes.icon} color={colors.primary} aria-hidden />
            <Text variant="bodyStrong" color="primary" style={styles.flex} numberOfLines={1}>
              {t('bookForm.series.create', { name: typed })}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {name || position ? (
        <Button
          variant="ghost"
          label={t('bookForm.series.clear')}
          icon={<MaterialCommunityIcons name="close" size={sizes.icon} color={colors.primary} />}
          onPress={() => {
            onNameChange('');
            onPositionChange('');
            setSearching(false);
          }}
          testID={Testids.seriesInput.clear}
          style={{ paddingHorizontal: spacing.md }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  pair: { flexDirection: 'row', flexWrap: 'wrap' },
  wide: { flexGrow: 3, flexBasis: 180 },
  narrow: { flexGrow: 1, flexBasis: 100 },
  flex: { flex: 1, minWidth: 0 },
  list: { borderWidth: 1, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center' },
  divider: { borderTopWidth: 1 },
});
