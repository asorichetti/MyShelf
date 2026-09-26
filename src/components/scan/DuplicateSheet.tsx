import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { CoverImage } from '@/components/book/CoverImage';
import { Booky } from '@/components/booky';
import { Button, CatalogueCard, Heading, Text } from '@/components/ui';
import { MODAL_ANIMATION } from '@/components/ui/modalAnimation';
import { joinNames } from '@/domain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
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
 * Add another copy and Cancel. Modal: focus stays inside, Escape and Android
 * back cancel.
 */
export function DuplicateSheet({ visible, existing, busy = false, onOpen, onAddCopy, onCancel }: DuplicateSheetProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const reduceMotion = useReducedMotion();
  const book = existing[0];
  const copies = existing.length;
  return (
    <Modal visible={visible && Boolean(book)} transparent animationType={reduceMotion ? 'none' : MODAL_ANIMATION} onRequestClose={busy ? () => {} : onCancel} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim, padding: spacing.lg }]}>
        {book ? (
          <View
            role="alertdialog"
            aria-modal
            aria-labelledby="duplicate-title"
            testID={Testids.duplicate.sheet}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.lg,
                padding: spacing.xl,
                gap: spacing.md,
                maxWidth: theme.sizes.bubbleMaxWidth,
                boxShadow: theme.elevation.raised,
              },
            ]}
          >
            <View style={[styles.headerRow, { gap: spacing.md }]}>
              <Booky expression="concerned" size={56} animated={false} />
              <View style={styles.fill}>
                <Heading level={2} nativeID="duplicate-title">
                  Already on your shelf
                </Heading>
                <Text color="inkMuted">
                  {copies === 1 ? 'You’ve catalogued this book before.' : `You’ve catalogued ${copies} copies of this book.`}
                </Text>
              </View>
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
            <View style={[styles.actions, { gap: spacing.sm }]}>
              <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={busy} testID={Testids.duplicate.cancel} />
              <Button label="Add another copy" variant="secondary" onPress={onAddCopy} loading={busy} testID={Testids.duplicate.addCopy} />
              <Button label="Open it" onPress={onOpen} disabled={busy} testID={Testids.duplicate.open} />
            </View>
          </View>
        ) : null}
        {/* After the sheet in the DOM, so the web focus trap starts inside it. */}
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          focusable={false}
          style={StyleSheet.absoluteFill}
          onPress={busy ? undefined : onCancel}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheet: { width: '100%', borderWidth: 1, zIndex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
});
