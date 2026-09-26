import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Booky, HelpButton } from '@/components/booky';
import { SeriesBookList } from '@/components/series/SeriesBookList';
import { SeriesShelf, seriesSlots } from '@/components/series/SeriesShelf';
import { booksText, progressSentence } from '@/components/series/seriesText';
import { Button, ConfirmDialog, EmptyState, Heading, IconButton, Menu, Screen, Text, TextField, useSnackbar } from '@/components/ui';
import type { Book, Series, SeriesProgress } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { parseSeriesId, useSeries, type SeriesActions } from './useSeries';
import { useSeriesOptions } from './useSeriesOptions';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

/** Back to wherever the user came from, or the series list. */
function goBackOrSeries() {
  if (router.canGoBack()) router.back();
  else router.replace('/series');
}

/** A whole number from 1 to 10,000, '' for "not sure", or an error message. */
export function parseTotalCount(text: string): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = text.trim();
  if (!t) return { ok: true, value: null };
  if (!/^\d+$/.test(t) || Number(t) < 1 || Number(t) > 10_000) return { ok: false, message: 'Use a whole number, like 9.' };
  return { ok: true, value: Number(t) };
}

function ProgressBar({ owned, total }: { owned: number; total: number }) {
  const { colors, radii } = useTheme();
  const pct = total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;
  return (
    <View
      accessible
      role="progressbar"
      aria-label="Books owned"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={owned}
      accessibilityValue={{ min: 0, max: total, now: owned }}
      style={[styles.track, { backgroundColor: colors.primaryContainer, borderRadius: radii.pill }]}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: pct === 100 ? colors.success : colors.primary, borderRadius: radii.pill }]} />
    </View>
  );
}

function TotalEditor({ series, progress, onSave }: { series: Series; progress: SeriesProgress; onSave: (total: number | null) => Promise<void> }) {
  const { spacing } = useTheme();
  const { show } = useSnackbar();
  const [text, setText] = useState(series.totalCount != null ? String(series.totalCount) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const unchanged = text.trim() === (series.totalCount != null ? String(series.totalCount) : '');
  const save = async () => {
    const parsed = parseTotalCount(text);
    if (!parsed.ok) return setError(parsed.message);
    if (parsed.value != null && progress.maxPosition != null && parsed.value < Math.floor(progress.maxPosition)) {
      return setError(`You already have #${Math.floor(progress.maxPosition)}, so it has at least ${Math.floor(progress.maxPosition)}.`);
    }
    setSaving(true);
    try {
      await onSave(parsed.value);
      show({ message: parsed.value == null ? `I’ll work out the length of ${series.name} from your books` : `Saved: ${series.name} has ${booksText(parsed.value)}` });
    } catch (e) {
      console.error('Could not save the series total', e);
      show({ message: 'Sorry, I couldn’t save that. Please try again.' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={[styles.totalRow, { gap: spacing.sm }]}>
      <View style={styles.flex}>
        <TextField
          label="How many books are in this series?"
          value={text}
          onChangeText={(v) => {
            setText(v);
            setError(null);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={5}
          placeholder="Not sure"
          helperText="Leave it empty if you’re not sure. Gaps then run up to your highest number."
          errorText={error ?? undefined}
          onSubmitEditing={save}
          testID={Testids.seriesDetail.totalCount}
        />
      </View>
      <Button variant="secondary" label="Save" accessibilityLabel="Save the number of books" onPress={save} loading={saving} disabled={unchanged} testID={Testids.seriesDetail.totalSave} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

function RenameDialog({ visible, current, onCancel, onRename }: { visible: boolean; current: string; onCancel: () => void; onRename: (name: string) => Promise<void> }) {
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!name.trim()) return setError('A series needs a name.');
    setBusy(true);
    try {
      await onRename(name.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog visible={visible} title="Rename series" message="The new name shows on every book in the series." confirmLabel="Rename" busy={busy} onConfirm={confirm} onCancel={onCancel}>
      <TextField
        label="Series name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        autoCapitalize="words"
        errorText={error ?? undefined}
        testID={Testids.seriesDetail.renameInput}
      />
    </ConfirmDialog>
  );
}

function MergeDialog({ visible, series, bookCount, onCancel, onMerge }: { visible: boolean; series: Series; bookCount: number; onCancel: () => void; onMerge: (targetId: number) => Promise<void> }) {
  const { colors, spacing, radii, sizes } = useTheme();
  const others = useSeriesOptions().filter((s) => s.id !== series.id);
  const [target, setTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = others.find((s) => s.id === target);
  const confirm = async () => {
    if (target == null) return;
    setBusy(true);
    try {
      await onMerge(target);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog
      visible={visible}
      title={`Merge “${series.name}” into…`}
      message={
        chosen
          ? `Move ${booksText(bookCount)} into ${chosen.name}, keeping their numbers, and remove “${series.name}”?`
          : others.length
            ? 'Pick the series these books really belong to.'
            : 'There’s no other series to merge into yet.'
      }
      confirmLabel="Merge"
      busy={busy}
      onConfirm={chosen ? confirm : () => {}}
      onCancel={onCancel}
    >
      <View role="radiogroup" aria-label="Series to merge into" style={{ gap: spacing.xs }}>
        {others.map((s) => {
          const selected = s.id === target;
          return (
            <Pressable
              key={s.id}
              role="radio"
              aria-checked={selected}
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${s.name}, ${booksText(s.bookCount)}`}
              onPress={() => setTarget(s.id)}
              testID={Testids.seriesDetail.mergeOption}
              style={[
                styles.option,
                {
                  minHeight: sizes.touchTarget,
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.md,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.surfaceTint : colors.surface,
                },
              ]}
            >
              <MaterialCommunityIcons name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={sizes.icon} color={selected ? colors.primary : colors.outline} aria-hidden />
              <Text style={styles.flex} numberOfLines={1}>
                {s.name}
              </Text>
              <Text variant="caption" color="inkMuted">
                {booksText(s.bookCount)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ConfirmDialog>
  );
}

function SeriesContent({ series, books, progress, actions }: { series: Series; books: Book[]; progress: SeriesProgress; actions: SeriesActions }) {
  const theme = useTheme();
  const { spacing } = theme;
  const { show } = useSnackbar();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'rename' | 'merge' | 'delete' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const slots = seriesSlots(books, progress.gaps);
  const counts = { name: series.name, owned: progress.owned, total: progress.total, missing: progress.gaps.length, bookCount: books.length, totalCount: series.totalCount };

  const addAt = (position: number) => router.push({ pathname: '/book/new', params: { series: series.name, position: String(position) } });
  const firstMissing = progress.gaps[0] ?? null;

  return (
    <Screen testID={Testids.seriesDetail.root} edges={[...EDGES]}>
      <View style={[styles.bar, { gap: spacing.xs, marginTop: -spacing.sm, marginHorizontal: -spacing.sm }]}>
        <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={goBackOrSeries} testID={Testids.seriesDetail.back} />
        <View style={styles.flex} />
        <Button variant="ghost" label="All series" onPress={() => router.navigate('/series')} testID={Testids.seriesDetail.allSeries} style={{ paddingHorizontal: spacing.md }} />
        <HelpButton screen="series" />
        <IconButton icon="dots-vertical" accessibilityLabel="More actions" expanded={menuOpen} onPress={() => setMenuOpen(true)} testID={Testids.seriesDetail.more} />
      </View>
      <Menu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        accessibilityLabel={`More actions for ${series.name}`}
        testID={Testids.menu.root}
        items={[
          { label: 'Rename series', icon: 'pencil-outline', onPress: () => setDialog('rename'), testID: Testids.seriesDetail.rename },
          { label: 'Merge into another series', icon: 'call-merge', onPress: () => setDialog('merge'), testID: Testids.seriesDetail.merge },
          { label: 'Delete series', icon: 'trash-can-outline', destructive: true, onPress: () => setDialog('delete'), testID: Testids.seriesDetail.delete },
        ]}
      />

      <View style={{ gap: spacing.sm }}>
        <Text variant="stamp" color="accent">
          Series
        </Text>
        <Heading level={1} testID={Testids.seriesDetail.title}>
          {series.name}
        </Heading>
        <View style={{ gap: spacing.xs }} testID={Testids.seriesDetail.progress}>
          <Text variant="bodyStrong">{progressSentence(counts)}</Text>
          {progress.total != null ? <ProgressBar owned={progress.owned} total={progress.total} /> : null}
        </View>
      </View>

      {slots.length ? <SeriesShelf slots={slots} /> : null}

      <View style={{ gap: spacing.sm }}>
        <Heading level={2}>In reading order</Heading>
        {slots.length ? (
          <SeriesBookList seriesName={series.name} slots={slots} onOpenBook={(id) => router.push({ pathname: '/book/[id]', params: { id: String(id) } })} onAddGap={addAt} />
        ) : (
          <EmptyState
            illustration={<Booky expression="sleepy" size={80} />}
            title="No books here yet"
            message="Add the first book and it takes its place on this shelf."
            action={{ label: 'Add #1', onPress: () => addAt(1) }}
          />
        )}
        {firstMissing == null && progress.total != null && series.totalCount == null ? (
          <Text variant="caption" color="inkMuted">
            No gaps so far. Tell me how many books the series has to see what’s still to come.
          </Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Heading level={2}>Length</Heading>
        <TotalEditor key={series.totalCount ?? 'none'} series={series} progress={progress} onSave={actions.setTotal} />
      </View>

      <RenameDialog
        key={`rename-${dialog === 'rename'}`}
        visible={dialog === 'rename'}
        current={series.name}
        onCancel={() => setDialog(null)}
        onRename={async (name) => {
          await actions.rename(name);
          setDialog(null);
          show({ message: `Renamed to ${name}` });
        }}
      />
      <MergeDialog
        key={`merge-${dialog === 'merge'}`}
        visible={dialog === 'merge'}
        series={series}
        bookCount={books.length}
        onCancel={() => setDialog(null)}
        onMerge={async (targetId) => {
          const target = await actions.mergeInto(targetId);
          setDialog(null);
          if (target) {
            router.replace({ pathname: '/series/[id]', params: { id: String(target.id) } });
            show({ message: `Merged into ${target.name}` });
          }
        }}
      />
      <ConfirmDialog
        visible={dialog === 'delete'}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title="Delete this series?"
        message={books.length ? `The ${booksText(books.length)} stay on your shelf, just not as “${series.name}”.` : `“${series.name}” has no books; it just goes.`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        busy={deleting}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await actions.remove();
            setDialog(null);
            router.replace('/series');
            show({ message: `Deleted the series ${series.name}` });
          } catch (e) {
            console.error('Could not delete the series', e);
            setDeleting(false);
            show({ message: 'Sorry, I couldn’t delete that. Please try again.' });
          }
        }}
      />
    </Screen>
  );
}

/** Shown for a series id that does not exist (deleted, merged away, or a bad link). */
function SeriesMissing() {
  return (
    <Screen pageState="error" centered edges={[...EDGES]}>
      <EmptyState
        illustration={<Booky expression="concerned" size={120} />}
        headingLevel={1}
        title="Series not found"
        message="I couldn’t find that series. It may have been merged or deleted."
        action={{ label: 'All series', onPress: () => router.replace('/series') }}
      />
    </Screen>
  );
}

/** `/series/[id]`: a series as a shelf, in order, with its gaps (P04-05). */
export function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useSeries(parseSeriesId(id));
  if (state.status === 'missing') return <SeriesMissing />;
  if (state.status === 'loading') {
    return (
      <Screen pageState="loading" centered edges={[...EDGES]}>
        <Text color="inkMuted" align="center">
          Taking the series down from the shelf…
        </Text>
      </Screen>
    );
  }
  return <SeriesContent series={state.series} books={state.books} progress={state.progress} actions={state} />;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  track: { height: 10, overflow: 'hidden' },
  fill: { height: '100%' },
  totalRow: { flexDirection: 'row', alignItems: 'flex-start' },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
});
