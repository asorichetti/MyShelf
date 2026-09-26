import { StyleSheet, View } from 'react-native';

import { CoverImage } from '@/components/book/CoverImage';
import { Booky } from '@/components/booky';
import { Button, CatalogueCard, Sheet, Text } from '@/components/ui';
import { joinNames } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

/** The copy already on the shelf, as the sheet shows it. */
export interface DuplicateBook {
  title: string;
  authors: string[];
  publicationYear: number | null;
  coverUri: string | null;
  isbn13: string | null;
}

export interface DuplicateSheetProps {
  visible: boolean;
  /** The copies already catalogued (the first is shown). */
  existing: readonly DuplicateBook[];
  busy?: boolean;
  onOpen: () => void;
  onAddCopy: () => void;
  onCancel: () => void;
}

/**
 * "Already on your shelf" (P03-10): the book the scan matched, with Open it,
 * Add another copy and Cancel. A bottom sheet: focus stays inside, Escape,
 * Android back and a tap on the scrim cancel.
 */
export function DuplicateSheet({ visible, existing, busy = false, onOpen, onAddCopy, onCancel }: DuplicateSheetProps) {
  const { spacing } = useTheme();
  const book = existing[0];
  const copies = existing.length;
  return (
    <Sheet
      visible={visible && Boolean(book)}
      title={t('duplicate.title')}
      subtitle={t('duplicate.copies', { count: copies })}
      onClose={busy ? () => {} : onCancel}
      testID={Testids.duplicate.sheet}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} disabled={busy} testID={Testids.duplicate.cancel} />
          <Button label={t('duplicate.addCopy')} variant="secondary" onPress={onAddCopy} loading={busy} testID={Testids.duplicate.addCopy} />
          <Button label={t('duplicate.open')} onPress={onOpen} disabled={busy} testID={Testids.duplicate.open} />
        </>
      }
    >
      {book ? (
        <>
          <View style={[styles.row, { gap: spacing.md }]}>
            <Booky expression="concerned" size={48} animated={false} />
            <Text style={styles.fill}>{t('duplicate.question')}</Text>
          </View>
          <CatalogueCard
            title={book.title}
            authors={joinNames(book.authors) || null}
            isbn={book.isbn13}
            cover={<CoverImage uri={book.coverUri} title={book.title} author={book.authors[0]} size="thumb" />}
            meta={
              book.publicationYear != null ? (
                <Text variant="mono" color="inkMuted">
                  {book.publicationYear}
                </Text>
              ) : undefined
            }
          />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
});
