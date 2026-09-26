import { StyleSheet, View, type TextInput } from 'react-native';

import { Button, Chip, Text, TextField } from '@/components/ui';
import { addDraftGenre, genreSuggestions } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import type { Ref } from 'react';

export interface GenresInputProps {
  genres: string[];
  onChange: (genres: string[]) => void;
  /** The genre being typed (owned by the form, so Save can include it). */
  text: string;
  onTextChange: (text: string) => void;
  /** Genres already in the library (suggested before the starter list). */
  existing: readonly string[];
  errorText?: string;
  inputRef?: Ref<TextInput>;
}

/** Chosen genres as removable chips, with suggestions from the library and a starter list. */
export function GenresInput({ genres, onChange, text, onTextChange, existing, errorText, inputRef }: GenresInputProps) {
  const { spacing } = useTheme();
  const typed = text.trim();
  const suggestions = genreSuggestions(existing, genres, typed, typed ? 6 : 8);
  const add = (name: string) => {
    onChange(addDraftGenre(genres, name, existing));
    onTextChange('');
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {genres.length ? (
        <View role="list" aria-label="Chosen genres" style={[styles.wrap, { columnGap: spacing.sm }]}>
          {genres.map((g) => (
            <View role="listitem" key={g}>
              <Chip
                label={g}
                testID={Testids.bookForm.genreChip}
                removeLabel={`Remove genre ${g}`}
                onRemove={() => onChange(genres.filter((x) => x !== g))}
              />
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.row, { gap: spacing.sm, alignItems: 'flex-end' }]}>
        <View style={styles.flex}>
          <TextField
            ref={inputRef}
            label={genres.length ? 'Add another genre' : 'Genre'}
            value={text}
            onChangeText={onTextChange}
            placeholder="e.g. Fantasy"
            autoCapitalize="words"
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={() => add(text)}
            errorText={errorText}
            testID={Testids.bookForm.genreInput}
          />
        </View>
        <Button
          variant="secondary"
          label="Add"
          accessibilityLabel={typed ? `Add genre ${typed}` : 'Add genre'}
          disabled={!typed}
          onPress={() => add(text)}
          testID={Testids.bookForm.genreAdd}
          style={{ paddingHorizontal: spacing.lg }}
        />
      </View>
      {suggestions.length ? (
        <View style={{ gap: spacing.xxs }}>
          <Text variant="caption" color="inkMuted">
            {typed ? 'Matching genres' : 'Suggestions'}
          </Text>
          <View style={[styles.wrap, { columnGap: spacing.sm }]}>
            {suggestions.map((g) => (
              <Chip key={g} label={g} icon="plus" accessibilityLabel={`Add genre ${g}`} onPress={() => add(g)} testID={Testids.bookForm.genreSuggestion} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0 },
});
