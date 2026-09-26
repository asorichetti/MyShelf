import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { ScrollView, StyleSheet, View, type TextInput } from 'react-native';

import { Button, Chip, Heading, SelectField, Text, TextField } from '@/components/ui';
import { bookFormats, languages, type BookDraft, type BookDraftErrors, type BookDraftField, type BookFormat } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { AuthorsInput } from './AuthorsInput';
import { CoverImage } from './CoverImage';
import { GenresInput } from './GenresInput';

export const formatLabels: Record<BookFormat, string> = {
  hardcover: 'Hardback',
  paperback: 'Paperback',
  ebook: 'Ebook',
  audiobook: 'Audiobook',
  other: 'Other',
};

const fieldLabels: Record<BookDraftField, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  authors: 'Authors',
  isbn: 'ISBN',
  publisher: 'Publisher',
  year: 'Year',
  edition: 'Edition',
  format: 'Format',
  pages: 'Pages',
  language: 'Language',
  genres: 'Genres',
  seriesName: 'Series',
  seriesPosition: 'Number in series',
  summary: 'Summary',
  notes: 'Notes',
  coverUri: 'Cover',
};

const languageOptions = languages.map((l) => ({ value: l.code, label: l.name }));

/** "Please check 2 fields: Title and ISBN." */
export function errorSummary(errors: BookDraftErrors): string {
  const fields = (Object.keys(errors) as BookDraftField[]).map((f) => fieldLabels[f]);
  if (fields.length === 1) return `Please check the ${fields[0]} field.`;
  const list = `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`;
  return `Please check ${fields.length} fields: ${list}.`;
}

export interface BookFormHandle {
  /** Moves focus (and so the scroll position) to a field. */
  focusField: (field: BookDraftField) => void;
}

export interface BookFormProps {
  mode: 'add' | 'edit';
  draft: BookDraft;
  errors: BookDraftErrors;
  onChange: <K extends BookDraftField>(field: K, value: BookDraft[K]) => void;
  authorText: string;
  onAuthorTextChange: (text: string) => void;
  suggestAuthors: (prefix: string) => Promise<string[]>;
  genreText: string;
  onGenreTextChange: (text: string) => void;
  existingGenres: readonly string[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** Choose a photo of the cover, or take one. */
  onPickCover: (source: 'library' | 'camera') => void;
  /**
   * Online cover search (P02-11). When given, the Cover section offers
   * "Find a cover online"; until then the section offers photos only.
   */
  onFindCoverOnline?: () => void;
  ref?: Ref<BookFormHandle>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing, colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.sectionTitle, { borderBottomColor: colors.cardRule, paddingBottom: spacing.xs }]}>
        <Heading level={2}>{title}</Heading>
      </View>
      {children}
    </View>
  );
}

/**
 * The add/edit form, as a catalogue card being typed up: the book, its
 * edition, genres, series, then summary and notes, with a Save bar that stays
 * in reach. Field errors show inline; after a failed save a summary at the top
 * lists them (the screen moves focus to the first).
 */
export function BookForm({
  mode,
  draft,
  errors,
  onChange,
  authorText,
  onAuthorTextChange,
  suggestAuthors,
  genreText,
  onGenreTextChange,
  existingGenres,
  saving,
  onSave,
  onCancel,
  onPickCover,
  onFindCoverOnline,
  ref,
}: BookFormProps) {
  const theme = useTheme();
  const { colors, spacing, sizes } = theme;
  const scroll = useRef<ScrollView>(null);
  // One ref per focusable field, so a failed save can focus the first invalid one.
  const titleRef = useRef<TextInput>(null);
  const subtitleRef = useRef<TextInput>(null);
  const authorsRef = useRef<TextInput>(null);
  const isbnRef = useRef<TextInput>(null);
  const publisherRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const editionRef = useRef<TextInput>(null);
  const pagesRef = useRef<TextInput>(null);
  const genresRef = useRef<TextInput>(null);
  const seriesNameRef = useRef<TextInput>(null);
  const seriesPositionRef = useRef<TextInput>(null);
  const summaryRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const languageRef = useRef<View>(null);

  useImperativeHandle(ref, () => ({
    focusField: (field) => {
      const targets: Partial<Record<BookDraftField, { focus?: () => void } | null>> = {
        title: titleRef.current,
        subtitle: subtitleRef.current,
        authors: authorsRef.current,
        isbn: isbnRef.current,
        publisher: publisherRef.current,
        year: yearRef.current,
        edition: editionRef.current,
        pages: pagesRef.current,
        genres: genresRef.current,
        seriesName: seriesNameRef.current,
        seriesPosition: seriesPositionRef.current,
        summary: summaryRef.current,
        notes: notesRef.current,
        language: languageRef.current as { focus?: () => void } | null,
      };
      const el = targets[field];
      if (el?.focus) el.focus();
      else scroll.current?.scrollTo({ y: 0, animated: false });
    },
  }));

  const hasErrors = Object.keys(errors).length > 0;
  return (
    <View style={styles.fill}>
      <ScrollView
        ref={scroll}
        testID={Testids.bookForm.root}
        style={styles.fill}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs }}>
          <Heading level={1} testID={Testids.bookForm.heading}>
            {mode === 'add' ? 'Add a book' : 'Edit book'}
          </Heading>
          <Text color="inkMuted">
            {mode === 'add' ? 'Type up a new catalogue card. Only the title is required.' : 'Change anything on the card, then save.'}
          </Text>
        </View>

        {hasErrors ? (
          <View
            role="alert"
            testID={Testids.bookForm.error}
            style={[styles.alert, { backgroundColor: colors.dangerContainer, borderColor: colors.danger, borderRadius: theme.radii.md, padding: spacing.md, gap: spacing.sm }]}
          >
            <MaterialCommunityIcons name="alert-circle-outline" size={sizes.icon} color={colors.onDangerContainer} aria-hidden />
            <Text color="onDangerContainer" style={styles.fill}>
              {errorSummary(errors)}
            </Text>
          </View>
        ) : null}

        <Section title="Cover">
          <View style={[styles.cover, { gap: spacing.lg }]}>
            <CoverImage uri={draft.coverUri} title={draft.title.trim() || 'New book'} author={draft.authors[0]?.name} size="medium" />
            <View style={[styles.coverActions, { gap: spacing.sm }]}>
              <Text variant="caption" color="inkMuted">
                {draft.coverUri ? 'This cover goes on the catalogue card.' : 'No cover yet: your shelf shows a cloth binding until you add one.'}
              </Text>
              <Button
                variant="secondary"
                label="Choose a photo"
                icon={<MaterialCommunityIcons name="image-outline" size={sizes.icon} color={colors.onPrimaryContainer} />}
                onPress={() => onPickCover('library')}
                testID={Testids.bookForm.coverPick}
              />
              <Button
                variant="secondary"
                label="Take a photo"
                icon={<MaterialCommunityIcons name="camera-outline" size={sizes.icon} color={colors.onPrimaryContainer} />}
                onPress={() => onPickCover('camera')}
                testID={Testids.bookForm.coverCamera}
              />
              {onFindCoverOnline ? (
                <Button
                  variant="secondary"
                  label="Find a cover online"
                  icon={<MaterialCommunityIcons name="web" size={sizes.icon} color={colors.onPrimaryContainer} />}
                  onPress={onFindCoverOnline}
                />
              ) : null}
              {draft.coverUri ? (
                <Button variant="ghost" label="Remove cover" onPress={() => onChange('coverUri', null)} testID={Testids.bookForm.coverRemove} />
              ) : null}
            </View>
          </View>
        </Section>

        <Section title="The book">
          <TextField label="Title (required)" ref={titleRef} value={draft.title} onChangeText={(v) => onChange('title', v)} errorText={errors.title} testID={Testids.bookForm.title} autoCapitalize="words" maxLength={400} />
          <TextField label="Subtitle" ref={subtitleRef} value={draft.subtitle} onChangeText={(v) => onChange('subtitle', v)} errorText={errors.subtitle} testID={Testids.bookForm.subtitle} />
          <AuthorsInput
            authors={draft.authors}
            onChange={(a) => onChange('authors', a)}
            text={authorText}
            onTextChange={onAuthorTextChange}
            suggest={suggestAuthors}
            errorText={errors.authors}
            inputRef={authorsRef}
          />
        </Section>

        <Section title="Edition">
          <TextField
            label="ISBN"
            ref={isbnRef} value={draft.isbn} onChangeText={(v) => onChange('isbn', v)} errorText={errors.isbn}
            testID={Testids.bookForm.isbn}
            helperText="10 or 13 digits, usually on the back cover above the barcode."
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TextField label="Publisher" ref={publisherRef} value={draft.publisher} onChangeText={(v) => onChange('publisher', v)} errorText={errors.publisher} testID={Testids.bookForm.publisher} autoCapitalize="words" />
          <View style={[styles.pair, { gap: spacing.md }]}>
            <View style={styles.half}>
              <TextField label="Year" ref={yearRef} value={draft.year} onChangeText={(v) => onChange('year', v)} errorText={errors.year} testID={Testids.bookForm.year} keyboardType="number-pad" inputMode="numeric" maxLength={4} />
            </View>
            <View style={styles.half}>
              <TextField label="Pages" ref={pagesRef} value={draft.pages} onChangeText={(v) => onChange('pages', v)} errorText={errors.pages} testID={Testids.bookForm.pages} keyboardType="number-pad" inputMode="numeric" maxLength={6} />
            </View>
          </View>
          <TextField label="Edition" ref={editionRef} value={draft.edition} onChangeText={(v) => onChange('edition', v)} errorText={errors.edition} testID={Testids.bookForm.edition} placeholder="e.g. First edition" />
          <View style={{ gap: spacing.xs }}>
            <Text variant="label" color={errors.format ? 'danger' : 'ink'}>
              Format
            </Text>
            <View role="radiogroup" aria-label="Format" testID={Testids.bookForm.format} style={[styles.wrap, { columnGap: spacing.sm }]}>
              {bookFormats.map((f) => (
                <Chip
                  key={f}
                  label={formatLabels[f]}
                  role="radio"
                  selected={draft.format === f}
                  onPress={() => onChange('format', draft.format === f ? '' : f)}
                />
              ))}
            </View>
          </View>
          <SelectField
            ref={languageRef}
            label="Language"
            value={draft.language}
            options={languageOptions}
            onChange={(v) => onChange('language', v)}
            errorText={errors.language}
            testID={Testids.bookForm.language}
          />
        </Section>

        <Section title="Genres">
          <GenresInput
            genres={draft.genres}
            onChange={(g) => onChange('genres', g)}
            text={genreText}
            onTextChange={onGenreTextChange}
            existing={existingGenres}
            errorText={errors.genres}
            inputRef={genresRef}
          />
        </Section>

        <Section title="Series">
          <View style={[styles.pair, { gap: spacing.md }]}>
            <View style={styles.wide}>
              <TextField label="Series name" ref={seriesNameRef} value={draft.seriesName} onChangeText={(v) => onChange('seriesName', v)} errorText={errors.seriesName} testID={Testids.bookForm.seriesName} autoCapitalize="words" placeholder="e.g. Discworld" />
            </View>
            <View style={styles.narrow}>
              <TextField
                label="Number"
                ref={seriesPositionRef} value={draft.seriesPosition} onChangeText={(v) => onChange('seriesPosition', v)} errorText={errors.seriesPosition}
                testID={Testids.bookForm.seriesPosition}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="e.g. 5"
                maxLength={6}
              />
            </View>
          </View>
        </Section>

        <Section title="Summary and notes">
          <TextField label="Summary" ref={summaryRef} value={draft.summary} onChangeText={(v) => onChange('summary', v)} errorText={errors.summary} testID={Testids.bookForm.summary} multiline />
          <TextField
            label="Notes"
            ref={notesRef} value={draft.notes} onChangeText={(v) => onChange('notes', v)} errorText={errors.notes}
            testID={Testids.bookForm.notes}
            multiline
            helperText="Just for you: where you got it, who signed it, what you thought."
          />
        </Section>
      </ScrollView>

      <View style={[styles.bar, { borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm }]}>
        <Button variant="ghost" label="Cancel" onPress={onCancel} testID={Testids.bookForm.cancel} disabled={saving} />
        <Button
          label={mode === 'add' ? 'Save to shelf' : 'Save changes'}
          onPress={onSave}
          loading={saving}
          testID={Testids.bookForm.save}
          icon={<MaterialCommunityIcons name="check" size={sizes.icon} color={colors.onPrimary} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sectionTitle: { borderBottomWidth: 1.5 },
  alert: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5 },
  pair: { flexDirection: 'row', flexWrap: 'wrap' },
  half: { flexGrow: 1, flexBasis: 140 },
  wide: { flexGrow: 3, flexBasis: 180 },
  narrow: { flexGrow: 1, flexBasis: 100 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  cover: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  coverActions: { flex: 1, minWidth: 180 },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1 },
});
