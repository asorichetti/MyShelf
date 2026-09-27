import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { ScrollView, StyleSheet, View, type TextInput } from 'react-native';

import { Button, Chip, Heading, SelectField, StarRating, Text, TextField } from '@/components/ui';
import { bookFormats, joinNames, languages, TITLE_MAX, type BookDraft, type BookDraftErrors, type BookDraftField, type BookFormat } from '@/domain';
import { t, translate, type MessageKey } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { AuthorsInput } from './AuthorsInput';
import { CoverImage } from './CoverImage';
import { GenresInput } from './GenresInput';
import { SeriesInput, type SeriesOption, type SeriesSuggestion } from './SeriesInput';

/** Each format's name, translated when read. */
export const formatLabels: Readonly<Record<BookFormat, string>> = {
  get hardcover() {
    return t('book.formats.hardcover');
  },
  get paperback() {
    return t('book.formats.paperback');
  },
  get ebook() {
    return t('book.formats.ebook');
  },
  get audiobook() {
    return t('book.formats.audiobook');
  },
  get other() {
    return t('book.formats.otherFormat');
  },
};

const fieldLabels: Record<BookDraftField, MessageKey> = {
  title: 'bookFields.title',
  subtitle: 'bookFields.subtitle',
  authors: 'bookFields.authors',
  isbn: 'bookForm.fields.isbn',
  publisher: 'bookFields.publisher',
  year: 'bookFields.year',
  edition: 'bookFields.edition',
  format: 'bookFields.format',
  pages: 'bookFields.pages',
  language: 'bookFields.language',
  genres: 'bookFields.genres',
  seriesName: 'bookFields.series',
  seriesPosition: 'bookForm.fields.seriesPosition',
  summary: 'bookFields.summary',
  notes: 'bookForm.fields.notes',
  coverUri: 'bookFields.cover',
  rating: 'bookForm.fields.rating',
};

const NO_SERIES: readonly SeriesOption[] = [];

/** "Please check 2 fields: Title and ISBN." */
export function errorSummary(errors: BookDraftErrors): string {
  const fields = (Object.keys(errors) as BookDraftField[]).map((f) => translate(fieldLabels[f]));
  return t('bookForm.errorSummary', { count: fields.length, fields: joinNames(fields) });
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
  /** Series already in the library, for the series picker. */
  existingSeries?: readonly SeriesOption[];
  /** A series hint from the lookup the draft came from (P02-08): shown as "Suggested: Discworld #5". */
  seriesSuggestion?: SeriesSuggestion | null;
  /** Extra content under the heading, e.g. the add form's "Find it online" lookup (P02-11). */
  header?: React.ReactNode;
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
  existingSeries = NO_SERIES,
  seriesSuggestion = null,
  header,
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
  const languageOptions = languages.map((l) => ({ value: l.code, label: l.name }));
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
            {mode === 'add' ? t('common.addABook') : t('bookForm.editHeading')}
          </Heading>
          <Text color="inkMuted">
            {mode === 'add' ? t('bookForm.addIntro') : t('bookForm.editIntro')}
          </Text>
        </View>

        {header}

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

        <Section title={t('bookFields.cover')}>
          <View style={[styles.cover, { gap: spacing.lg }]}>
            <CoverImage uri={draft.coverUri} title={draft.title.trim() || t('bookForm.cover.untitled')} author={draft.authors[0]?.name} size="medium" />
            <View style={[styles.coverActions, { gap: spacing.sm }]}>
              <Text variant="caption" color="inkMuted">
                {draft.coverUri ? t('bookForm.cover.hasCover') : t('bookForm.cover.noCover')}
              </Text>
              <Button
                variant="secondary"
                label={t('bookForm.cover.choosePhoto')}
                icon={<MaterialCommunityIcons name="image-outline" size={sizes.icon} color={colors.onPrimaryContainer} />}
                onPress={() => onPickCover('library')}
                testID={Testids.bookForm.coverPick}
              />
              <Button
                variant="secondary"
                label={t('bookForm.cover.takePhoto')}
                icon={<MaterialCommunityIcons name="camera-outline" size={sizes.icon} color={colors.onPrimaryContainer} />}
                onPress={() => onPickCover('camera')}
                testID={Testids.bookForm.coverCamera}
              />
              {onFindCoverOnline ? (
                <Button
                  variant="secondary"
                  label={t('bookForm.cover.findOnline')}
                  icon={<MaterialCommunityIcons name="web" size={sizes.icon} color={colors.onPrimaryContainer} />}
                  onPress={onFindCoverOnline}
                  testID={Testids.lookup.findCover}
                />
              ) : null}
              {draft.coverUri ? (
                <Button variant="ghost" label={t('bookForm.cover.remove')} onPress={() => onChange('coverUri', null)} testID={Testids.bookForm.coverRemove} />
              ) : null}
            </View>
          </View>
        </Section>

        <Section title={t('bookForm.sections.theBook')}>
          <TextField label={t('bookForm.fields.titleRequired')} ref={titleRef} value={draft.title} onChangeText={(v) => onChange('title', v)} errorText={errors.title} testID={Testids.bookForm.title} autoCapitalize="words" maxLength={TITLE_MAX} />
          <TextField label={t('bookFields.subtitle')} ref={subtitleRef} value={draft.subtitle} onChangeText={(v) => onChange('subtitle', v)} errorText={errors.subtitle} testID={Testids.bookForm.subtitle} />
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

        <Section title={t('bookFields.edition')}>
          <TextField
            label={t('bookForm.fields.isbn')}
            ref={isbnRef} value={draft.isbn} onChangeText={(v) => onChange('isbn', v)} errorText={errors.isbn}
            testID={Testids.bookForm.isbn}
            helperText={t('bookForm.isbnHelp')}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TextField label={t('bookFields.publisher')} ref={publisherRef} value={draft.publisher} onChangeText={(v) => onChange('publisher', v)} errorText={errors.publisher} testID={Testids.bookForm.publisher} autoCapitalize="words" />
          <View style={[styles.pair, { gap: spacing.md }]}>
            <View style={styles.half}>
              <TextField label={t('bookFields.year')} ref={yearRef} value={draft.year} onChangeText={(v) => onChange('year', v)} errorText={errors.year} testID={Testids.bookForm.year} keyboardType="number-pad" inputMode="numeric" maxLength={4} />
            </View>
            <View style={styles.half}>
              <TextField label={t('bookFields.pages')} ref={pagesRef} value={draft.pages} onChangeText={(v) => onChange('pages', v)} errorText={errors.pages} testID={Testids.bookForm.pages} keyboardType="number-pad" inputMode="numeric" maxLength={6} />
            </View>
          </View>
          <TextField label={t('bookFields.edition')} ref={editionRef} value={draft.edition} onChangeText={(v) => onChange('edition', v)} errorText={errors.edition} testID={Testids.bookForm.edition} placeholder={t('bookForm.editionPlaceholder')} />
          <View style={{ gap: spacing.xs }}>
            <Text variant="label" color={errors.format ? 'danger' : 'ink'}>
              {t('bookFields.format')}
            </Text>
            <View role="radiogroup" aria-label={t('bookFields.format')} testID={Testids.bookForm.format} style={[styles.wrap, { columnGap: spacing.sm }]}>
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
            label={t('bookFields.language')}
            value={draft.language}
            options={languageOptions}
            onChange={(v) => onChange('language', v)}
            errorText={errors.language}
            testID={Testids.bookForm.language}
          />
        </Section>

        <Section title={t('bookFields.genres')}>
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

        <Section title={t('bookFields.series')}>
          <SeriesInput
            name={draft.seriesName}
            position={draft.seriesPosition}
            onNameChange={(v) => onChange('seriesName', v)}
            onPositionChange={(v) => onChange('seriesPosition', v)}
            existing={existingSeries}
            suggestion={seriesSuggestion}
            nameError={errors.seriesName}
            positionError={errors.seriesPosition}
            nameRef={seriesNameRef}
            positionRef={seriesPositionRef}
          />
        </Section>

        <Section title={t('bookForm.fields.rating')}>
          <View testID={Testids.bookForm.rating} style={{ gap: spacing.xs }}>
            <StarRating value={draft.rating} onChange={(r) => onChange('rating', r)} />
            <Text variant="caption" color="inkMuted">
              {t('bookForm.ratingHelp')}
            </Text>
          </View>
        </Section>

        <Section title={t('bookForm.sections.summaryAndNotes')}>
          <TextField label={t('bookFields.summary')} ref={summaryRef} value={draft.summary} onChangeText={(v) => onChange('summary', v)} errorText={errors.summary} testID={Testids.bookForm.summary} multiline />
          <TextField
            label={t('bookForm.fields.notes')}
            ref={notesRef} value={draft.notes} onChangeText={(v) => onChange('notes', v)} errorText={errors.notes}
            testID={Testids.bookForm.notes}
            multiline
            helperText={t('bookForm.notesHelp')}
          />
        </Section>
      </ScrollView>

      <View style={[styles.bar, { borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm }]}>
        <Button variant="ghost" label={t('common.cancel')} onPress={onCancel} testID={Testids.bookForm.cancel} disabled={saving} />
        <Button
          label={mode === 'add' ? t('bookForm.saveNew') : t('bookForm.saveChanges')}
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
  bar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1 },
});
