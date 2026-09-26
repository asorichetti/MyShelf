import { StyleSheet, View } from 'react-native';

import { CatalogueCard, Text } from '@/components/ui';
import { callNumber, joinNames, languageName, type BookDetail } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useFontScale, useTheme } from '@/theme';

import { formatLabels } from './BookForm';
import { CallNumber } from './CallNumber';
import { CoverImage } from './CoverImage';

const FACT_WIDTH = 120;

/** "Terry Pratchett and Neil Gaiman", with non-author roles noted: "Quentin Blake (illustrator)". */
export function creditLine(authors: BookDetail['authors']): string {
  return joinNames(authors.map((a) => (a.role === 'author' ? a.name : t('book.header.credit', { name: a.name, role: t(`book.header.creditRoles.${a.role}`) }))));
}

/** The facts on the card, in catalogue order; empty ones are left out. */
export function bookFacts(book: BookDetail): { label: string; value: string; mono?: boolean }[] {
  const facts: { label: string; value: string | null | undefined; mono?: boolean }[] = [
    { label: t('bookFields.publisher'), value: book.publisher },
    { label: t('bookFields.year'), value: book.publicationYear?.toString() },
    { label: t('bookFields.edition'), value: book.edition },
    { label: t('bookFields.format'), value: book.format ? formatLabels[book.format] : null },
    { label: t('bookFields.pages'), value: book.pageCount?.toString() },
    { label: t('bookFields.language'), value: book.language ? languageName(book.language) : null },
    { label: t('book.header.isbn13'), value: book.isbn13, mono: true },
    { label: t('book.header.isbn10'), value: book.isbn10, mono: true },
  ];
  return facts.filter((f): f is { label: string; value: string; mono?: boolean } => Boolean(f.value));
}

/** The detail page's header: a large catalogue card with cover, title, credits, call number and facts. */
export function BookHeader({ book }: { book: BookDetail }) {
  const { spacing } = useTheme();
  // Two facts side by side at 100 % text; one per line once a larger font would split their words.
  const factWidth = FACT_WIDTH * useFontScale();
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
            <View key={f.label} style={[styles.fact, { minWidth: factWidth, flexBasis: factWidth }]}>
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
  fact: { flexGrow: 1 },
});
