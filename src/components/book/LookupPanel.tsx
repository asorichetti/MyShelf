import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookyBubble, tipById } from '@/components/booky';
import { Button, Heading, Text, TextField } from '@/components/ui';
import { formatIsbn13, isValidIsbn13, normalizeIsbn } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { CandidateList } from './CandidateList';

import type { CandidateCardData } from './CandidateCard';

export type LookupPanelStatus = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export interface LookupPanelProps {
  status: LookupPanelStatus;
  mode?: 'isbn' | 'search';
  /** What was looked up. */
  query?: string;
  /** For `error`. */
  message?: string;
  candidates: readonly CandidateCardData[];
  /** A provider that did not answer while the other did. */
  warning?: string | null;
  /** The candidate the form was filled from, if any. */
  chosen?: { title: string; source: string } | null;
  onLookupIsbn: (text: string) => void;
  onSearch: (text: string) => void;
  onCancel: () => void;
  onChoose: (index: number) => void;
  /** "Add it by hand": close the lookup and go to the form. */
  onAddManually: () => void;
  /** Look for a different book after choosing one. */
  onSearchAgain: () => void;
}

/** "Looking up 978-0-552-16659-1…" or "Searching for “dune”…". */
export function loadingMessage(mode: 'isbn' | 'search' | undefined, query = ''): string {
  if (mode === 'isbn') {
    const isbn = normalizeIsbn(query) ?? query;
    return t('bookForm.lookup.lookingUp', { isbn: isValidIsbn13(isbn) ? formatIsbn13(isbn) : query });
  }
  return t('bookForm.lookup.searching', { query });
}

/**
 * The top of the add form (P02-11): look a book up by ISBN or search the
 * online catalogues, then pick a result to fill in the card. Booky thinks
 * while it looks, and suggests typing the book in by hand when nothing turns
 * up. Presentational: the add screen owns the lookup.
 */
export function LookupPanel(props: LookupPanelProps) {
  const { status, mode, query, message, candidates, warning, chosen } = props;
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const [isbn, setIsbn] = useState('');
  const [text, setText] = useState('');

  if (chosen) {
    return (
      <View testID={Testids.lookup.chosen} style={{ backgroundColor: colors.successContainer, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs }}>
        <View style={[styles.chosen, { gap: spacing.sm }]}>
          <MaterialCommunityIcons name="check-circle-outline" size={sizes.icon} color={colors.onSuccessContainer} aria-hidden />
          <Text color="onSuccessContainer" style={styles.fill}>
            {t('bookForm.lookup.chosen', { source: chosen.source })}
          </Text>
        </View>
        <Button variant="ghost" label={t('bookForm.lookup.searchAgain')} onPress={props.onSearchAgain} testID={Testids.lookup.searchAgain} />
      </View>
    );
  }

  const busy = status === 'loading';
  return (
    <View testID={Testids.lookup.root} style={{ gap: spacing.md }}>
      <View style={[styles.sectionTitle, { borderBottomColor: colors.cardRule, paddingBottom: spacing.xs }]}>
        <Heading level={2}>{t('bookForm.lookup.heading')}</Heading>
      </View>
      <Text color="inkMuted">{t('bookForm.lookup.intro')}</Text>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={styles.field}>
          <TextField
            label={t('bookForm.fields.isbn')}
            value={isbn}
            onChangeText={setIsbn}
            testID={Testids.lookup.isbnInput}
            placeholder={t('bookForm.lookup.isbnPlaceholder')}
            keyboardType="number-pad"
            inputMode="numeric"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => props.onLookupIsbn(isbn)}
            editable={!busy}
          />
        </View>
        <Button label={t('bookForm.lookup.lookUp')} onPress={() => props.onLookupIsbn(isbn)} disabled={busy} testID={Testids.lookup.isbnSubmit} />
      </View>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={styles.field}>
          <TextField
            label={t('bookForm.lookup.searchLabel')}
            value={text}
            onChangeText={setText}
            testID={Testids.lookup.searchInput}
            placeholder={t('bookForm.lookup.searchPlaceholder')}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => props.onSearch(text)}
            editable={!busy}
          />
        </View>
        <Button variant="secondary" label={t('bookForm.lookup.search')} onPress={() => props.onSearch(text)} disabled={busy} testID={Testids.lookup.searchSubmit} />
      </View>

      {status === 'loading' ? (
        <BookyBubble
          testID={Testids.lookup.loading}
          expression="thinking"
          message={loadingMessage(mode, query)}
          actions={[{ label: t('common.cancel'), onPress: props.onCancel, testID: Testids.lookup.cancel }]}
        />
      ) : null}
      {status === 'empty' ? (
        <BookyBubble
          testID={Testids.lookup.noResults}
          expression="concerned"
          title={mode === 'isbn' ? t('bookForm.lookup.noIsbnMatch') : t('bookForm.lookup.noMatches')}
          message={tipById('lookup-none').text}
          actions={[{ label: t('bookForm.lookup.addByHand'), onPress: props.onAddManually, testID: Testids.lookup.addManually }]}
        />
      ) : null}
      {status === 'error' ? (
        <View role="alert" testID={Testids.lookup.error}>
          <BookyBubble expression="concerned" message={message ?? ''} actions={[{ label: t('bookForm.lookup.addByHand'), onPress: props.onAddManually }]} />
        </View>
      ) : null}
      {status === 'results' ? (
        <>
          {warning ? (
            <Text variant="caption" color="inkMuted" testID={Testids.lookup.warning}>
              {warning}
            </Text>
          ) : null}
          <CandidateList
            candidates={candidates}
            onChoose={props.onChoose}
            label={t('bookForm.lookup.results', { count: candidates.length })}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sectionTitle: { borderBottomWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' },
  field: { flexGrow: 1, flexBasis: 200 },
  chosen: { flexDirection: 'row', alignItems: 'flex-start' },
});
