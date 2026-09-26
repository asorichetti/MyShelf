import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { CatalogueCard, Stamp, Text } from '@/components/ui';
import { joinNames, languageName, type CandidateLike } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { formatLabels } from './BookForm';
import { CoverImage } from './CoverImage';

/** What a candidate card shows; a metadata `BookCandidate` is one. */
export type CandidateCardData = Pick<
  CandidateLike,
  | 'kind'
  | 'title'
  | 'subtitle'
  | 'authors'
  | 'publisher'
  | 'publicationYear'
  | 'pageCount'
  | 'isbn13'
  | 'isbn10'
  | 'language'
  | 'format'
  | 'coverUrl'
  | 'source'
  | 'editionCount'
>;

export const sourceLabels: Record<CandidateCardData['source'], string> = {
  openlibrary: 'Open Library',
  googlebooks: 'Google Books',
};

/** "1985 · Corgi Books · Paperback · 285 pages" (an edition) or "First published 1983 · 120 editions" (a work). */
export function candidateFacts(c: CandidateCardData): string[] {
  if (c.kind === 'work') {
    return [
      c.publicationYear != null ? `First published ${c.publicationYear}` : null,
      c.editionCount ? `${c.editionCount} ${c.editionCount === 1 ? 'edition' : 'editions'}` : null,
    ].filter((x): x is string => Boolean(x));
  }
  return [
    c.publicationYear != null ? String(c.publicationYear) : null,
    c.publisher,
    c.format ? formatLabels[c.format] : null,
    c.pageCount ? `${c.pageCount} pages` : null,
    c.language && c.language !== 'en' ? languageName(c.language) : null,
  ].filter((x): x is string => Boolean(x));
}

/**
 * What a screen reader says for a candidate: "Hardback, Doubleday, 1987, 285
 * pages, ISBN 9780385…" style facts after the title and authors.
 */
export function candidateLabel(c: CandidateCardData): string {
  const parts = [c.title];
  if (c.authors.length) parts.push(`by ${joinNames(c.authors)}`);
  // Lower-case the generic words ("paperback", "first published"), never a publisher's name.
  const generic = new Set([...Object.values(formatLabels), 'First published']);
  parts.push(...candidateFacts(c).map((f) => (generic.has(f) || f.startsWith('First published') ? f.charAt(0).toLowerCase() + f.slice(1) : f)));
  const isbn = c.isbn13 ?? c.isbn10;
  if (isbn) parts.push(`ISBN ${isbn}`);
  parts.push(`from ${sourceLabels[c.source]}`);
  return parts.join(', ');
}

export interface CandidateCardProps {
  candidate: CandidateCardData;
  onPress: () => void;
  /** `radio` inside a picker (with `selected`), `button` in a result list. */
  role?: 'button' | 'radio';
  selected?: boolean;
  testID?: string;
  /** Extra line under the facts, e.g. "Tap to see its editions". */
  hint?: string;
  /** Replaces the spoken description (the edition picker leads with the edition's facts). */
  accessibilityLabel?: string;
}

/**
 * One lookup result as a catalogue card: the real cover, title, authors,
 * year, publisher, format and ISBN, with a stamp naming the catalogue it
 * came from. The whole card is the touch target.
 */
export function CandidateCard({ candidate: c, onPress, role = 'button', selected, testID = Testids.lookup.candidate, hint, accessibilityLabel }: CandidateCardProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const author = joinNames(c.authors);
  const facts = candidateFacts(c);
  const isbn = c.isbn13 ?? c.isbn10;
  const radio = role === 'radio';
  return (
    <Pressable
      role={role}
      accessibilityLabel={accessibilityLabel ?? candidateLabel(c)}
      aria-label={accessibilityLabel ?? candidateLabel(c)}
      {...(radio ? { 'aria-checked': Boolean(selected), accessibilityState: { checked: Boolean(selected) } } : {})}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.press,
        {
          borderRadius: radii.md + 2,
          borderColor: selected ? colors.primary : 'transparent',
          minHeight: sizes.touchTarget,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <CatalogueCard
        title={c.title}
        subtitle={c.subtitle}
        authors={author || null}
        isbn={c.kind === 'edition' ? isbn : null}
        cover={<CoverImage uri={c.coverUrl} title={c.title} author={author} size="thumb" />}
        aside={selected ? <MaterialCommunityIcons name="check-circle" size={sizes.icon + 8} color={colors.primary} aria-hidden /> : undefined}
        meta={
          <View style={{ gap: spacing.xxs, marginTop: spacing.xxs }}>
            {facts.length ? (
              <Text variant="caption" color="inkMuted">
                {facts.join(' · ')}
              </Text>
            ) : null}
            <View style={[styles.stamp, { marginTop: spacing.xs }]}>
              <Stamp label={sourceLabels[c.source]} tone="accent" rotate={-2} />
            </View>
            {hint ? (
              <Text variant="caption" color="primary">
                {hint}
              </Text>
            ) : null}
          </View>
        }
        style={selected ? { backgroundColor: colors.surfaceTint } : undefined}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { borderWidth: 2 },
  stamp: { alignSelf: 'flex-start' },
});
