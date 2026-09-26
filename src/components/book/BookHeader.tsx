import { StyleSheet, View } from 'react-native';

import { CatalogueCard, Text } from '@/components/ui';
import { callNumber, joinNames, languageName, type BookDetail } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { CallNumber } from './CallNumber';
import { CoverImage } from './CoverImage';

const FORMAT_NAMES: Record<string, string> = {
  hardcover: 'Hardback',
  paperback: 'Paperback',
  ebook: 'Ebook',
  audiobook: 'Audiobook',
  other: 'Other',
};

/** "Terry Pratchett and Neil Gaiman", with non-author roles noted: "Quentin Blake (illustrator)". */
export function creditLine(authors: BookDetail['authors']): string {
  return joinNames(authors.map((a) => (a.role === 'author' ? a.name : `${a.name} (${a.role})`)));
}

/** The facts on the card, in catalogue order; empty ones are left out. */
export function bookFacts(book: BookDetail): { label: string; value: string; mono?: boolean }[] {
  const facts: { label: string; value: string | null | undefined; mono?: boolean }[] = [
    { label: 'Publisher', value: book.publisher },
    { label: 'Year', value: book.publicationYear?.toString() },
    { label: 'Edition', value: book.edition },
    { label: 'Format', value: book.format ? FORMAT_NAMES[book.format] : null },
    { label: 'Pages', value: book.pageCount?.toString() },
    { label: 'Language', value: book.language ? languageName(book.language) : null },
    { label: 'ISBN-13', value: book.isbn13, mono: true },
    { label: 'ISBN-10', value: book.isbn10, mono: true },
  ];
  return facts.filter((f): f is { label: string; value: string; mono?: boolean } => Boolean(f.value));
}

/** The detail page's header: a large catalogue card with cover, title, credits, call number and facts. */
export function BookHeader({ book }: { book: BookDetail }) {
  const { spacing } = useTheme();
  const credits = creditLine(book.authors);
  const first = book.authors[0];
  const call = callNumber({
    genres: book.genres.map((g) => g.name),
    author: first ? (first.sortName ?? first.name) : null,
    title: book.title,
    year: book.publicationYear,
  });
  const facts = bookFacts(book);
  return (
    <CatalogueCard
      size="header"
      title={book.title}
      titleLevel={1}
      titleTestID={Testids.bookDetail.title}
      subtitle={book.subtitle}
      authors={credits || null}
      authorsTestID={Testids.bookDetail.authors}
      cover={<CoverImage uri={book.coverUri} title={book.title} author={credits} size="medium" />}
      meta={
        <View style={{ marginTop: spacing.sm }}>
          <CallNumber value={call} testID={Testids.bookDetail.callNumber} />
        </View>
      }
    >
      {facts.length ? (
        <View testID={Testids.bookDetail.facts} style={[styles.facts, { rowGap: spacing.sm, columnGap: spacing.lg }]}>
          {facts.map((f) => (
            <View key={f.label} style={styles.fact}>
              <Text variant="label" color="inkMuted">
                {f.label}
              </Text>
              <Text variant={f.mono ? 'mono' : 'body'} selectable>
                {f.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </CatalogueCard>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', flexWrap: 'wrap' },
  fact: { minWidth: 120, flexGrow: 1, flexBasis: 120 },
});
