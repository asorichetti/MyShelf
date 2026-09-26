import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import { BookRow } from '@/components/book/BookRow';
import { ShelfToolbar } from '@/components/book/ShelfToolbar';
import { Booky, useBooky } from '@/components/booky';
import { Button, EmptyState, Heading, Screen, Text, useSnackbar } from '@/components/ui';
import type { BookListItem } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useShelf } from './useShelf';

const plural = (n: number) => (n === 1 ? '1 book' : `${n} books`);

/** What the live region under the toolbar says (and a screen reader announces). */
export function resultSummary(count: number, total: number, query: string): string {
  if (!query) return `Showing all ${plural(total)}`;
  if (count === 0) return `No books match “${query}”`;
  return `${count} of ${plural(total)} match “${query}”`;
}

export function ShelfScreen() {
  const theme = useTheme();
  const { spacing, sizes, colors } = theme;
  const { showTip } = useBooky();
  const { snack } = useSnackbar();
  const shelf = useShelf();
  const { items, total, activeQuery } = shelf;
  const isEmpty = total === 0;

  const openBook = useCallback((id: number) => router.navigate({ pathname: '/book/[id]', params: { id: String(id) } }), []);
  const addBook = useCallback(() => router.navigate('/book/new'), []);
  const renderItem = useCallback<ListRenderItem<BookListItem>>(({ item }) => <BookRow item={item} onPress={openBook} />, [openBook]);

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
      <View style={{ gap: spacing.xs }}>
        <Heading level={1} testID={Testids.home.title}>
          MyShelf
        </Heading>
        <Text color="inkMuted">Your personal library, one shelf at a time.</Text>
        {total != null ? (
          <Text variant="stamp" color="accent" testID={Testids.home.bookCount}>
            {total === 1 ? '1 book catalogued' : `${total} books catalogued`}
          </Text>
        ) : null}
      </View>
      {total != null && !isEmpty ? (
        <>
          <ShelfToolbar query={shelf.query} onQueryChange={shelf.setQuery} sort={shelf.sort} onSortChange={shelf.setSort} />
          <Text
            variant="caption"
            color="inkMuted"
            role="status"
            aria-live="polite"
            accessibilityLiveRegion="polite"
            testID={Testids.home.resultCount}
          >
            {items ? resultSummary(items.length, total, activeQuery) : ' '}
          </Text>
        </>
      ) : null}
    </View>
  );

  const emptyShelf = (
    <View style={{ gap: spacing.sm }}>
      <EmptyState
        testID={Testids.emptyState.root}
        illustration={<Booky expression="happy" size={120} testID={Testids.booky.avatar} />}
        title="Your shelf is empty"
        message="Scan a book's barcode or cover and I'll fill in the title, author, genre and series for you. Or type it in yourself."
        action={{ label: 'Scan a book', onPress: () => router.navigate('/scan'), testID: Testids.home.scanAction }}
        secondaryAction={{ label: 'Add manually', onPress: addBook, testID: Testids.home.addButton }}
      />
      <Button
        variant="ghost"
        label="What can Booky do?"
        testID={Testids.home.askBooky}
        style={{ alignSelf: 'center' }}
        onPress={() =>
          showTip({
            title: 'Hi, I’m Booky!',
            message: 'I keep track of your books, who has borrowed them, and which series you’re part-way through.',
            expression: 'excited',
          })
        }
      />
    </View>
  );

  const noMatches = (
    <EmptyState
      testID={Testids.home.noMatches}
      illustration={<Booky expression="thinking" size={96} />}
      title="No matches"
      message={`Nothing on your shelf matches “${activeQuery}”. Check the spelling, or try an author, series or ISBN.`}
      action={{ label: 'Clear search', onPress: () => shelf.setQuery(''), variant: 'secondary' }}
    />
  );

  return (
    <Screen testID={Testids.home.root} scroll={false} contentStyle={[styles.fill, { paddingBottom: 0 }]}>
      <FlatList
        testID={Testids.home.list}
        data={isEmpty ? [] : (items ?? [])}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={isEmpty ? emptyShelf : items && activeQuery ? noMatches : null}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{ paddingBottom: sizes.touchTarget + spacing.xxl * 2, paddingHorizontal: spacing.xxs }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        style={styles.fill}
      />
      {!isEmpty && total != null ? (
        <Button
          label="Add book"
          testID={Testids.home.addButton}
          onPress={addBook}
          icon={<MaterialCommunityIcons name="plus" size={sizes.icon} color={colors.onPrimary} />}
          style={[
            styles.fab,
            {
              right: spacing.lg,
              // Step up out of the way while a snackbar is showing.
              bottom: spacing.lg + (snack ? sizes.touchTarget + spacing.xl : 0),
              boxShadow: theme.elevation.raised,
            },
          ]}
        />
      ) : null}
    </Screen>
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <View style={{ height: spacing.md }} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fab: { position: 'absolute' },
});
