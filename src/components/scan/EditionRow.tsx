import { formatLabels } from '@/components/book/BookForm';
import { CandidateCard, sourceLabels, type CandidateCardData } from '@/components/book/CandidateCard';
import { languageName } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';

/**
 * "Hardback, Doubleday, 1987, 285 pages, ISBN 9780385…, The Colour of Magic":
 * what a screen reader says for an edition, facts first so editions of the
 * same work are told apart quickly.
 */
export function editionLabel(c: CandidateCardData): string {
  const isbn = c.isbn13 ?? c.isbn10;
  const parts = [
    c.format ? formatLabels[c.format] : null,
    c.publisher,
    c.publicationYear != null ? String(c.publicationYear) : null,
    c.pageCount ? t('editions.row.pages', { count: c.pageCount }) : null,
    c.language && c.language !== 'en' ? languageName(c.language) : null,
    isbn ? t('editions.row.isbn', { isbn }) : t('editions.row.noIsbn'),
    c.title,
    t('editions.row.from', { source: sourceLabels[c.source] }),
    // The cover is how a sighted reader spots their edition; say whether there is one to compare.
    c.coverUrl ? t('editions.row.withCover') : t('editions.row.noCover'),
  ];
  return parts.filter(Boolean).join(t('editions.row.separator'));
}

export interface EditionRowProps {
  edition: CandidateCardData;
  selected: boolean;
  onSelect: () => void;
}

/** One edition in the picker: a radio card with its cover, publisher, year, format, pages and ISBN. */
export function EditionRow({ edition, selected, onSelect }: EditionRowProps) {
  return (
    <CandidateCard
      candidate={edition}
      role="radio"
      selected={selected}
      onPress={onSelect}
      testID={Testids.picker.edition}
      accessibilityLabel={editionLabel(edition)}
    />
  );
}
