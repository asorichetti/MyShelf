import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookyBubble, tipById } from '@/components/booky';
import { Button, Heading, Text, TextField } from '@/components/ui';
import { formatIsbn13, isValidIsbn13, normalizeIsbn } from '@/domain';
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
    return `Looking up ${isValidIsbn13(isbn) ? formatIsbn13(isbn) : query}…`;
  }
  return `Searching the catalogues for “${query}”…`;
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
            {`Filled in from ${chosen.source}. Check the card below, change anything you like, then save.`}
          </Text>
        </View>
        <Button variant="ghost" label="Look up another book" onPress={props.onSearchAgain} testID={Testids.lookup.searchAgain} />
      </View>
    );
  }

  const busy = status === 'loading';
  return (
    <View testID={Testids.lookup.root} style={{ gap: spacing.md }}>
      <View style={[styles.sectionTitle, { borderBottomColor: colors.cardRule, paddingBottom: spacing.xs }]}>
        <Heading level={2}>Find it online</Heading>
      </View>
      <Text color="inkMuted">Look the book up and I’ll fill in the card for you, cover and all.</Text>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={styles.field}>
          <TextField
            label="ISBN"
            value={isbn}
            onChangeText={setIsbn}
            testID={Testids.lookup.isbnInput}
            placeholder="e.g. 978-0-552-16659-1"
            keyboardType="number-pad"
            inputMode="numeric"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => props.onLookupIsbn(isbn)}
            editable={!busy}
          />
        </View>
        <Button label="Look up" onPress={() => props.onLookupIsbn(isbn)} disabled={busy} testID={Testids.lookup.isbnSubmit} />
      </View>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={styles.field}>
          <TextField
            label="Search online"
            value={text}
            onChangeText={setText}
            testID={Testids.lookup.searchInput}
            placeholder="Title and author, e.g. colour of magic pratchett"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => props.onSearch(text)}
            editable={!busy}
          />
        </View>
        <Button variant="secondary" label="Search" onPress={() => props.onSearch(text)} disabled={busy} testID={Testids.lookup.searchSubmit} />
      </View>

      {status === 'loading' ? (
        <BookyBubble
          testID={Testids.lookup.loading}
          expression="thinking"
          message={loadingMessage(mode, query)}
          actions={[{ label: 'Cancel', onPress: props.onCancel, testID: Testids.lookup.cancel }]}
        />
      ) : null}
      {status === 'empty' ? (
        <BookyBubble
          testID={Testids.lookup.noResults}
          expression="concerned"
          title={mode === 'isbn' ? 'No match for that ISBN' : 'No matches'}
          message={tipById('lookup-none').text}
          actions={[{ label: 'Add it by hand', onPress: props.onAddManually, testID: Testids.lookup.addManually }]}
        />
      ) : null}
      {status === 'error' ? (
        <View role="alert" testID={Testids.lookup.error}>
          <BookyBubble expression="concerned" message={message ?? ''} actions={[{ label: 'Add it by hand', onPress: props.onAddManually }]} />
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
            label={`${candidates.length === 1 ? '1 match' : `${candidates.length} matches`}. Choose yours to fill in the card.`}
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
