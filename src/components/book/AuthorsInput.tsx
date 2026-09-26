import { useEffect, useId, useState, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Chip, IconButton, Text, TextField } from '@/components/ui';
import { addDraftAuthor, toSortName, type AuthorRole, type DraftAuthor } from '@/domain';
import { t, translate, type MessageKey } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

/** The roles offered in an author's details, with the catalogue key naming each. */
export const authorRoles: { role: AuthorRole; labelKey: MessageKey }[] = [
  { role: 'author', labelKey: 'book.roles.author' },
  { role: 'illustrator', labelKey: 'book.roles.illustrator' },
  { role: 'translator', labelKey: 'book.roles.translator' },
  { role: 'editor', labelKey: 'book.roles.editor' },
];

export interface AuthorsInputProps {
  authors: DraftAuthor[];
  onChange: (authors: DraftAuthor[]) => void;
  /** The name being typed (owned by the form, so Save can include it). */
  text: string;
  onTextChange: (text: string) => void;
  /** Existing author names starting with the prefix. */
  suggest: (prefix: string) => Promise<string[]>;
  errorText?: string;
  inputRef?: Ref<TextInput>;
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The book's credits: type a name to add it (picking an existing author from
 * the suggestions reuses them), reorder with up and down buttons, and open
 * "details" to set the role or how the name is filed ("Le Guin, Ursula K.").
 */
export function AuthorsInput({ authors, onChange, text, onTextChange, suggest, errorText, inputRef }: AuthorsInputProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const listId = `authors-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const prefix = text.trim();
    if (!prefix) return;
    let active = true;
    const timer = setTimeout(() => {
      suggest(prefix)
        .then((names) => active && setSuggestions(names.filter((n) => !authors.some((a) => a.name.toLowerCase() === n.toLowerCase())).slice(0, 5)))
        .catch(() => active && setSuggestions([]));
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text, suggest, authors]);

  const add = (name: string) => {
    onChange(addDraftAuthor(authors, name));
    onTextChange('');
  };
  const update = (i: number, patch: Partial<DraftAuthor>) => onChange(authors.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const typed = text.trim();
  // Suggestions belong to what is typed now; nothing typed, nothing suggested.
  const shown = typed ? suggestions : [];
  const exact = shown.some((s) => s.toLowerCase() === typed.toLowerCase());

  return (
    <View style={{ gap: spacing.sm }}>
      {authors.length ? (
        <Text variant="label" nativeID={listId}>
          {authors.length === 1 ? t('bookForm.authors.listOne') : t('bookForm.authors.listMany')}
        </Text>
      ) : null}
      {authors.length ? (
        <View role="list" aria-labelledby={listId} style={{ gap: spacing.sm }}>
          {authors.map((a, i) => {
            const roleLabel = translate(authorRoles.find((r) => r.role === a.role)!.labelKey);
            const expanded = open === a.name;
            return (
              <View
                role="listitem"
                key={a.name}
                testID={Testids.bookForm.authorChip}
                style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceTint, borderRadius: radii.md, padding: spacing.xs, paddingLeft: spacing.md }]}
              >
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={2}>
                      {a.name}
                    </Text>
                    <Text variant="caption" color="inkMuted">
                      {a.role === 'author' ? t('bookForm.authors.filedAs', { name: a.sortName || toSortName(a.name) }) : roleLabel}
                    </Text>
                  </View>
                  {authors.length > 1 ? (
                    <>
                      <IconButton icon="arrow-up" accessibilityLabel={t('bookForm.authors.moveUp', { name: a.name })} disabled={i === 0} onPress={() => onChange(move(authors, i, i - 1))} />
                      <IconButton
                        icon="arrow-down"
                        accessibilityLabel={t('bookForm.authors.moveDown', { name: a.name })}
                        disabled={i === authors.length - 1}
                        onPress={() => onChange(move(authors, i, i + 1))}
                      />
                    </>
                  ) : null}
                  <IconButton
                    icon={expanded ? 'chevron-up' : 'tune-variant'}
                    accessibilityLabel={t('bookForm.authors.details', { name: a.name })}
                    expanded={expanded}
                    onPress={() => setOpen(expanded ? null : a.name)}
                  />
                  <IconButton icon="close" accessibilityLabel={t('bookForm.authors.remove', { name: a.name })} onPress={() => onChange(authors.filter((_, j) => j !== i))} />
                </View>
                {expanded ? (
                  <View style={{ gap: spacing.sm, paddingRight: spacing.sm, paddingBottom: spacing.sm }}>
                    <Text variant="label">{t('bookForm.authors.role')}</Text>
                    <View role="radiogroup" aria-label={t('bookForm.authors.roleOf', { name: a.name })} style={[styles.wrap, { columnGap: spacing.sm }]}>
                      {authorRoles.map((r) => (
                        <Chip key={r.role} label={translate(r.labelKey)} role="radio" selected={a.role === r.role} onPress={() => update(i, { role: r.role })} />
                      ))}
                    </View>
                    <TextField
                      label={t('bookForm.authors.filedAsLabel')}
                      value={a.sortName ?? ''}
                      placeholder={toSortName(a.name)}
                      helperText={t('bookForm.authors.filedAsHelp')}
                      onChangeText={(v) => update(i, { sortName: v || null })}
                      autoCapitalize="words"
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={[styles.row, { gap: spacing.sm, alignItems: 'flex-end' }]}>
        <View style={styles.flex}>
          <TextField
            ref={inputRef}
            label={authors.length ? t('bookForm.authors.inputMore') : t('bookForm.authors.inputFirst')}
            value={text}
            onChangeText={onTextChange}
            placeholder={t('bookForm.authors.placeholder')}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={() => add(text)}
            errorText={errorText}
            testID={Testids.bookForm.authorInput}
          />
        </View>
        <Button
          variant="secondary"
          label={t('bookForm.add')}
          accessibilityLabel={typed ? t('bookForm.authors.addTyped', { name: typed }) : t('bookForm.authors.addEmpty')}
          disabled={!typed}
          onPress={() => add(text)}
          testID={Testids.bookForm.authorAdd}
          style={{ alignSelf: 'flex-end', marginBottom: errorText ? spacing.xl : 0, paddingHorizontal: spacing.lg }}
        />
      </View>
      {typed && shown.length && !exact ? (
        <View aria-label={t('bookForm.authors.suggestions')} style={[styles.suggestions, { borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface }]}>
          {shown.map((name) => (
            <Pressable
              key={name}
              role="button"
              accessibilityLabel={t('bookForm.authors.addSuggestion', { name })}
              onPress={() => add(name)}
              testID={Testids.bookForm.authorSuggestion}
              style={({ pressed }) => [styles.suggestion, { minHeight: 48, paddingHorizontal: spacing.md, gap: spacing.sm }, pressed && { backgroundColor: colors.surfaceTint }]}
            >
              <Text>{name}</Text>
              <Text variant="caption" color="inkMuted">
                {t('bookForm.authors.inLibrary')}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0 },
  card: { borderWidth: 1 },
  suggestions: { borderWidth: 1, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
