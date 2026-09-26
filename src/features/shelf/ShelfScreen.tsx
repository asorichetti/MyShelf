import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type SectionListRenderItem } from 'react-native';

import { BookRow } from '@/components/book/BookRow';
import { BrowseChips, type BrowseTarget } from '@/components/book/BrowseChips';
import { chunk, CoverGridRow, coverColumns } from '@/components/book/CoverGrid';
import { FilterSheet } from '@/components/book/FilterSheet';
import { SectionHeader } from '@/components/book/SectionHeader';
import { SelectionBar } from '@/components/book/SelectionBar';
import { ShelfToolbar } from '@/components/book/ShelfToolbar';
import { SortSheet } from '@/components/book/SortSheet';
import { SpineShelf, spinesPerShelf } from '@/components/book/SpineShelf';
import { Booky, HelpButton, useBooky } from '@/components/booky';
import { GroupEditorSheet, type GroupDraft } from '@/components/groups/GroupEditorSheet';
import { GroupPickerSheet } from '@/components/groups/GroupPickerSheet';
import { ShelfLoanStamp } from '@/components/loans/ShelfLoanStamp';
import { Button, Chip, ConfirmDialog, EmptyState, Heading, Screen, Text, useFloatClearance, useSnackbar } from '@/components/ui';
import { useBottomObstacle } from '@/components/ui/layers';
import type { ShelfSection } from '@/db';
import { describeSort, sortKeyList } from '@/db/sortKeys';
import { activeFilterCount, filterChips, languages, matchingPreset, noFilters, today, type BookListItem, type ShelfGroupBy } from '@/domain';
import { useGroups } from '@/features/groups/useGroups';
import { ShelfPendingBanner } from '@/features/lookup/PendingLookupsProvider';
import { goBackOr } from '@/features/navigation/goBack';
import { parseId } from '@/features/navigation/parseId';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useDeleteBooks } from './useDeleteBooks';
import { useSelection } from './useSelection';
import { useShelf } from './useShelf';

/** What the live region under the toolbar says (and a screen reader announces). */
export function resultSummary(count: number, total: number, query: string, filtered = false): string {
  if (!query && !filtered) return t('shelf.summary.all', { count: total });
  if (count === 0) return query ? t('shelf.summary.noneMatchQuery', { query }) : t('shelf.summary.noneMatchFilters');
  if (!query) return t('shelf.summary.matchFilters', { matched: count, count: total });
  return t(filtered ? 'shelf.summary.matchQueryAndFilters' : 'shelf.summary.matchQuery', { matched: count, count: total, query });
}

const languageName = (code: string) => languages.find((l) => l.code === code)?.name ?? code.toUpperCase();

/** Where a section's header chevron leads. */
function sectionHref(groupBy: ShelfGroupBy, id: number): Href | null {
  const params = { id: String(id) };
  switch (groupBy) {
    case 'genre':
      return { pathname: '/genres/[id]', params };
    case 'series':
      return { pathname: '/series/[id]', params };
    case 'author':
      return { pathname: '/authors/[id]', params };
    case 'group':
      return { pathname: '/group/[id]', params };
    default:
      return null;
  }
}

const browseHref: Record<BrowseTarget, Href> = { genres: '/genres', series: '/series', authors: '/authors', groups: '/groups' };

/** A SectionList row: one book (list mode) or a row of covers or spines. */
type Row = { key: string; items: BookListItem[] };
type RowSection = { key: string; title: string; count: number; groupBy: ShelfGroupBy; id: number | null; data: Row[] };

function toRowSections(sections: ShelfSection[], perRow: number): RowSection[] {
  return sections.map((s) => ({
    key: s.sectionKey,
    title: s.sectionTitle,
    count: s.items.length,
    groupBy: s.groupBy,
    id: s.id,
    data:
      perRow === 1
        ? s.items.map((item) => ({ key: `${s.sectionKey}:${item.id}`, items: [item] }))
        : chunk(s.items, perRow).map((items, i) => ({ key: `${s.sectionKey}:row:${i}`, items })),
  }));
}

export function ShelfScreen() {
  const theme = useTheme();
  const { spacing, sizes, colors } = theme;
  const { emit, memoryVersion, mode: bookyMode } = useBooky();
  const { snack, show } = useSnackbar();
  const shelf = useShelf();
  const { sections, items, total, activeQuery, groupBy, viewMode, filters } = shelf;
  // `/?addTo=<group id>`: opened from a group's "Add books", so start picking books for it.
  const addTo = parseId(useLocalSearchParams<{ addTo?: string }>().addTo);
  const selection = useSelection(addTo != null);
  const groups = useGroups();
  const addToName = addTo != null ? (groups.groups?.find((g) => g.id === addTo)?.name ?? null) : null;
  const deleteBooks = useDeleteBooks();
  const window = useWindowDimensions();
  const [listWidth, setListWidth] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isEmpty = total === 0;
  // Booky's tips step aside for the Add book button (P07-07).
  const { attach: attachFab, onLayout: layoutFab } = useBottomObstacle(!selection.selecting && !isEmpty && total != null);
  // Room below the list for Booky's floating tip, so no row stays stuck under it.
  const { attach: attachRoom, onLayout: layoutRoom, clearance } = useFloatClearance();
  // Booky's empty-shelf tip: a welcome tip, once a session, only after the onboarding
  // (asked again when Booky's memory reloads, e.g. just after the onboarding finished).
  useEffect(() => {
    if (isEmpty) void emit({ type: 'shelf-empty' });
  }, [isEmpty, emit, memoryVersion]);
  const filterCount = activeFilterCount(filters);
  const genreNames = useMemo(() => new Map(shelf.filterOptions?.genres.map((g) => [g.id, g.name]) ?? []), [shelf.filterOptions]);
  const chips = filterChips(filters, (id) => genreNames.get(id), languageName);
  const sortDescription = describeSort(shelf.sort.levels, groupBy);
  const preset = matchingPreset(shelf.sort.levels, shelf.presets);
  const sortLabel = preset?.name ?? (shelf.sort.levels.length === 1 ? sortDescription : 'Custom');

  // Width the rows can use (the list pads 2 px each side).
  const width = (listWidth || Math.min(window.width, sizes.contentMaxWidth) - spacing.lg * 2) - spacing.xxs * 2;
  const perRow = viewMode === 'covers' ? coverColumns(width) : viewMode === 'spines' ? spinesPerShelf(width) : 1;
  const rowSections = useMemo(() => (sections ? toRowSections(sections, perRow) : []), [sections, perRow]);

  const { selecting, isSelected, toggle, start } = selection;
  const openBook = useCallback((id: number) => router.navigate({ pathname: '/book/[id]', params: { id: String(id) } }), []);
  const onPress = useCallback((id: number) => (selecting ? toggle(id) : openBook(id)), [selecting, toggle, openBook]);
  const onLongPress = useCallback((id: number) => start(id), [start]);
  const addBook = useCallback(() => router.navigate('/book/new'), []);
  const selectedCheck = selecting ? isSelected : undefined;

  const renderItem = useCallback<SectionListRenderItem<Row, RowSection>>(
    ({ item }) => {
      if (viewMode === 'covers') return <CoverGridRow items={item.items} columns={perRow} width={width} onPress={onPress} onLongPress={onLongPress} isSelected={selectedCheck} />;
      if (viewMode === 'spines') return <SpineShelf items={item.items} onPress={onPress} onLongPress={onLongPress} isSelected={selectedCheck} />;
      const book = item.items[0];
      return (
        <BookRow
          item={book}
          onPress={onPress}
          onLongPress={onLongPress}
          selected={selectedCheck?.(book.id)}
          badges={book.onLoan ? <ShelfLoanStamp item={book} today={today()} /> : undefined}
        />
      );
    },
    [viewMode, perRow, width, onPress, onLongPress, selectedCheck],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: RowSection }) => {
      if (section.groupBy === 'none') return null;
      const href = section.id != null ? sectionHref(section.groupBy, section.id) : null;
      return <SectionHeader title={section.title} count={section.count} onOpen={href && !selecting ? () => router.navigate(href) : undefined} />;
    },
    [selecting],
  );

  const addSelectedTo = async (groupId: number, name?: string) => {
    const ids = selection.ids;
    setPickerOpen(false);
    try {
      const added = await groups.addBooks(groupId, ids);
      const groupName = name ?? groups.groups?.find((g) => g.id === groupId)?.name ?? t('shelf.selection.theGroup');
      selection.exit();
      show({
        message: t(added === ids.length ? 'shelf.selection.added' : 'shelf.selection.addedSomeAlready', { count: added, group: groupName }),
        action: { label: t('shelf.selection.view'), onPress: () => router.navigate({ pathname: '/group/[id]', params: { id: String(groupId) } }) },
      });
    } catch (e) {
      console.error('Could not add the books to the group', e);
      show({ message: t('shelf.selection.addFailed') });
    }
  };

  const createAndAdd = async (draft: GroupDraft) => {
    const group = await groups.create(draft);
    setCreating(false);
    await addSelectedTo(group.id, group.name);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteBooks(selection.ids);
      selection.exit();
    } catch (e) {
      console.error('Could not delete the books', e);
      show({ message: t('shelf.selection.removeFailed') });
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const onListLayout = (e: LayoutChangeEvent) => setListWidth(e.nativeEvent.layout.width);

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
      <View style={{ gap: spacing.xs }}>
        <View style={[styles.titleRow, { gap: spacing.sm }]}>
          <Heading level={1} testID={Testids.home.title} style={styles.fill}>
            {t('shelf.screen.title')}
          </Heading>
          <HelpButton screen="shelf" />
        </View>
        <Text color="inkMuted">{t('shelf.screen.tagline')}</Text>
        {total != null ? (
          <Text variant="stamp" color="accent" testID={Testids.home.bookCount}>
            {t('shelf.screen.count', { count: total })}
          </Text>
        ) : null}
      </View>
      <ShelfPendingBanner />
      {total != null && !isEmpty ? (
        <>
          {shelf.query ? null : <BrowseChips onBrowse={(target) => router.navigate(browseHref[target])} />}
          <ShelfToolbar
            query={shelf.query}
            onQueryChange={shelf.setQuery}
            sortLabel={sortLabel}
            sortDescription={sortDescription}
            onOpenSort={() => setSortOpen(true)}
            sortOpen={sortOpen}
            groupBy={groupBy}
            onGroupByChange={shelf.setGroupBy}
            viewMode={viewMode}
            onViewModeChange={shelf.setViewMode}
            filterCount={filterCount}
            onOpenFilters={() => setFiltersOpen(true)}
            onSelect={selecting ? undefined : () => selection.start()}
          />
          {chips.length ? (
            <View role="group" aria-label={t('shelf.screen.activeFilters')} style={[styles.chips, { columnGap: spacing.sm }]}>
              {chips.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  removeLabel={t('shelf.screen.removeFilter', { label: c.label })}
                  onRemove={() => shelf.setFilters(c.without)}
                  testID={Testids.shelfView.filterChip}
                  removeTestID={Testids.shelfView.filterChipRemove}
                />
              ))}
              <Button variant="ghost" label={t('filters.sheet.clearAll')} accessibilityLabel={t('shelf.screen.clearAllFilters')} onPress={() => shelf.setFilters(noFilters)} testID={Testids.shelfView.filterClear} />
            </View>
          ) : null}
          <Text variant="caption" color="inkMuted" testID={Testids.home.sortSummary}>
            {`Sorted by ${sortDescription}`}
          </Text>
          <Text
            variant="caption"
            color="inkMuted"
            role="status"
            aria-live="polite"
            accessibilityLiveRegion="polite"
            testID={Testids.home.resultCount}
          >
            {items ? resultSummary(items.length, total, activeQuery, filterCount > 0) : ' '}
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
        title={t('shelf.empty.title')}
        message={t('shelf.empty.message')}
        action={{ label: t('shelf.empty.scan'), onPress: () => router.navigate('/scan'), testID: Testids.home.scanAction }}
        secondaryAction={{ label: t('shelf.empty.addManually'), onPress: addBook, testID: Testids.home.addButton }}
      />
      {/* Booky Off: no character to introduce. */}
      {bookyMode === 'off' ? null : (
        <Button
          variant="ghost"
          label={t('shelf.empty.askBooky')}
          testID={Testids.home.askBooky}
          style={{ alignSelf: 'center' }}
          onPress={() => void emit({ type: 'help-requested', screen: 'booky' })}
        />
      )}
    </View>
  );

  const noMatches = activeQuery ? (
    <EmptyState
      testID={Testids.home.noMatches}
      illustration={<Booky expression="thinking" size={96} />}
      title={t('shelf.noMatches.title')}
      message={t(filterCount ? 'shelf.noMatches.queryWithFilters' : 'shelf.noMatches.query', { query: activeQuery })}
      action={{ label: t('shelf.noMatches.clearSearch'), onPress: () => shelf.setQuery(''), variant: 'secondary' }}
    />
  ) : (
    <EmptyState
      testID={Testids.home.noMatches}
      illustration={<Booky expression="thinking" size={96} />}
      title={t('shelf.noMatches.filtersTitle')}
      message={t('shelf.noMatches.filtersMessage')}
      action={{ label: t('shelf.noMatches.clearFilters'), onPress: () => shelf.setFilters(noFilters), variant: 'secondary' }}
    />
  );

  return (
    <Screen testID={Testids.home.root} scroll={false} contentStyle={[styles.fill, { paddingBottom: 0 }]}>
      {/* Measured for the room Booky's tip needs (a list cannot measure itself in the window). */}
      <View ref={attachRoom} onLayout={layoutRoom} style={styles.fill}>
        <SectionList
          testID={Testids.home.list}
          sections={isEmpty ? [] : rowSections}
          keyExtractor={(row) => row.key}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={header}
          ListEmptyComponent={isEmpty ? emptyShelf : items && (activeQuery || filterCount) ? noMatches : null}
          ItemSeparatorComponent={viewMode === 'list' ? Separator : viewMode === 'covers' ? SmallSeparator : null}
          onLayout={onListLayout}
          contentContainerStyle={{ paddingBottom: sizes.touchTarget * (selecting ? 4 : 1) + spacing.xxl * 2 + clearance, paddingHorizontal: spacing.xxs }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // Section headers and footers take slots too, so a first screenful needs a few more.
          initialNumToRender={16}
          maxToRenderPerBatch={16}
          windowSize={9}
          style={styles.fill}
        />
      </View>
      {selecting && addTo != null ? (
        <SelectionBar
          count={selection.count}
          onCancel={() => {
            selection.exit();
            goBackOr({ pathname: '/group/[id]', params: { id: String(addTo) } });
          }}
          addLabel={addToName ? t('shelf.selection.addTo', { name: addToName }) : t('shelf.selection.addToGroup')}
          onAddToGroup={async () => {
            await addSelectedTo(addTo, addToName ?? undefined);
            goBackOr({ pathname: '/group/[id]', params: { id: String(addTo) } });
          }}
          style={[styles.bar, { left: spacing.md, right: spacing.md, bottom: spacing.md + (snack ? sizes.touchTarget + spacing.xl : 0) }]}
        />
      ) : selecting ? (
        <SelectionBar
          count={selection.count}
          onCancel={selection.exit}
          onAddToGroup={() => setPickerOpen(true)}
          onDelete={() => setConfirmingDelete(true)}
          style={[styles.bar, { left: spacing.md, right: spacing.md, bottom: spacing.md + (snack ? sizes.touchTarget + spacing.xl : 0) }]}
        />
      ) : !isEmpty && total != null ? (
        <View
          ref={attachFab}
          onLayout={layoutFab}
          style={[
            styles.fab,
            {
              right: spacing.lg,
              // Step up out of the way while a snackbar is showing.
              bottom: spacing.lg + (snack ? sizes.touchTarget + spacing.xl : 0),
            },
          ]}
        >
          <Button
            label={t('shelf.screen.addBook')}
            testID={Testids.home.addButton}
            onPress={addBook}
            icon={<MaterialCommunityIcons name="plus" size={sizes.icon} color={colors.onPrimary} />}
            style={{ boxShadow: theme.elevation.raised }}
          />
        </View>
      ) : null}
      <FilterSheet
        visible={filtersOpen}
        filters={filters}
        options={shelf.filterOptions ?? { genres: [], formats: [], languages: [], minYear: null, maxYear: null, hasRatings: false }}
        onChange={shelf.setFilters}
        onClose={() => setFiltersOpen(false)}
        languageName={languageName}
      />
      <SortSheet
        visible={sortOpen}
        keys={sortKeyList}
        describe={describeSort}
        sort={shelf.sort}
        groupBy={groupBy}
        presets={shelf.presets}
        onChange={shelf.setSort}
        onPresetsChange={shelf.setPresets}
        onClose={() => setSortOpen(false)}
      />
      <GroupPickerSheet
        visible={pickerOpen}
        title={t('shelf.selection.pickerTitle', { count: selection.count })}
        groups={groups.groups ?? []}
        onPick={(id) => addSelectedTo(id)}
        onNew={() => {
          setPickerOpen(false);
          setCreating(true);
        }}
        onClose={() => setPickerOpen(false)}
      />
      <GroupEditorSheet visible={creating} onSave={createAndAdd} onCancel={() => setCreating(false)} />
      <ConfirmDialog
        visible={confirmingDelete}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title={t('shelf.removeDialog.title', { count: selection.count })}
        message={t('shelf.removeDialog.message', { count: selection.count })}
        confirmLabel={t('common.remove')}
        cancelLabel={t('shelf.removeDialog.keep')}
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </Screen>
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <View style={{ height: spacing.md }} />;
}

function SmallSeparator() {
  const { spacing } = useTheme();
  return <View style={{ height: spacing.sm }} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fab: { position: 'absolute' },
  bar: { position: 'absolute' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
});
