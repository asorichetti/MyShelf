import { formatLabels } from '@/components/book/BookForm';
import { CandidateCard, sourceLabels, type CandidateCardData } from '@/components/book/CandidateCard';
import { languageName } from '@/domain';
import { Testids } from '@/testing/testids.gen';

/**
 * "Hardback, Doubleday, 1987, 285 pages, ISBN 9780385…, The Colour of Magic":
 * what a screen reader says for an edition, facts first so editions of the
 * same work are told apart quickly.
 */
export function editionLabel(c: CandidateCardData): string {
  const parts = [
    c.format ? formatLabels[c.format] : null,
    c.publisher,
    c.publicationYear != null ? String(c.publicationYear) : null,
    c.pageCount ? `${c.pageCount} pages` : null,
    c.language && c.language !== 'en' ? languageName(c.language) : null,
    c.isbn13 ?? c.isbn10 ? `ISBN ${c.isbn13 ?? c.isbn10}` : 'no ISBN',
    c.title,
    `from ${sourceLabels[c.source]}`,
  ];
  return parts.filter(Boolean).join(', ');
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
