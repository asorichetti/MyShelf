import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Booky, HelpButton, useBookyTopic } from '@/components/booky';
import { SeriesBookList } from '@/components/series/SeriesBookList';
import { SeriesShelf, seriesSlots } from '@/components/series/SeriesShelf';
import { booksText, progressSentence } from '@/components/series/seriesText';
import { Button, ConfirmDialog, EmptyState, Heading, IconButton, Menu, Screen, Text, TextField, useSnackbar } from '@/components/ui';
import type { Book, Series, SeriesProgress } from '@/domain';
import { t } from '@/i18n';
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
  const clean = text.trim();
  if (!clean) return { ok: true, value: null };
  if (!/^\d+$/.test(clean) || Number(clean) < 1 || Number(clean) > 10_000) return { ok: false, message: t('series.total.notWhole') };
  return { ok: true, value: Number(clean) };
}

function ProgressBar({ owned, total }: { owned: number; total: number }) {
  const { colors, radii } = useTheme();
  const pct = total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;
  return (
    <View
      accessible
      role="progressbar"
      aria-label={t('series.detail.progressBar')}
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
      const highest = Math.floor(progress.maxPosition);
      return setError(t('series.total.tooSmall', { position: highest, min: highest }));
    }
    setSaving(true);
    try {
      await onSave(parsed.value);
      show({ message: parsed.value == null ? t('series.total.cleared', { name: series.name }) : t('series.total.saved', { name: series.name, books: booksText(parsed.value) }) });
    } catch (e) {
      console.error('Could not save the series total', e);
      show({ message: t('common.saveFailed') });
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={[styles.totalRow, { gap: spacing.sm }]}>
      <View style={styles.flex}>
        <TextField
          label={t('series.total.label')}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setError(null);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={5}
          placeholder={t('series.total.placeholder')}
          helperText={t('series.total.helper')}
          errorText={error ?? undefined}
          onSubmitEditing={save}
          testID={Testids.seriesDetail.totalCount}
        />
      </View>
      <Button variant="secondary" label={t('common.save')} accessibilityLabel={t('series.total.saveLabel')} onPress={save} loading={saving} disabled={unchanged} testID={Testids.seriesDetail.totalSave} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

function RenameDialog({ visible, current, onCancel, onRename }: { visible: boolean; current: string; onCancel: () => void; onRename: (name: string) => Promise<void> }) {
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!name.trim()) return setError(t('series.renameDialog.nameRequired'));
    setBusy(true);
    try {
      await onRename(name.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog visible={visible} title={t('series.renameDialog.title')} message={t('series.renameDialog.message')} confirmLabel={t('series.renameDialog.confirm')} busy={busy} onConfirm={confirm} onCancel={onCancel}>
      <TextField
        label={t('series.renameDialog.nameLabel')}
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
      title={t('series.mergeDialog.title', { name: series.name })}
      message={
        chosen
          ? t('series.mergeDialog.confirmMessage', { books: booksText(bookCount), target: chosen.name, name: series.name })
          : others.length
            ? t('series.mergeDialog.pick')
            : t('series.mergeDialog.noOthers')
      }
      confirmLabel={t('common.merge')}
      busy={busy}
      onConfirm={chosen ? confirm : () => {}}
      onCancel={onCancel}
    >
      <View role="radiogroup" aria-label={t('series.mergeDialog.optionsLabel')} style={{ gap: spacing.xs }}>
        {others.map((s) => {
          const selected = s.id === target;
          return (
            <Pressable
              key={s.id}
              role="radio"
              aria-checked={selected}
              accessibilityState={{ checked: selected }}
              accessibilityLabel={t('series.mergeDialog.optionLabel', { name: s.name, books: booksText(s.bookCount) })}
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
        <IconButton icon="arrow-left" accessibilityLabel={t('common.back')} onPress={goBackOrSeries} testID={Testids.seriesDetail.back} />
        <View style={styles.flex} />
        <Button variant="ghost" label={t('series.detail.allSeries')} onPress={() => router.navigate('/series')} testID={Testids.seriesDetail.allSeries} style={{ paddingHorizontal: spacing.md }} />
        <HelpButton screen="series" />
        <IconButton icon="dots-vertical" accessibilityLabel={t('series.detail.moreActions')} expanded={menuOpen} onPress={() => setMenuOpen(true)} testID={Testids.seriesDetail.more} />
      </View>
      <Menu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        accessibilityLabel={t('series.detail.moreActionsFor', { name: series.name })}
        testID={Testids.menu.root}
        items={[
          { label: t('series.detail.rename'), icon: 'pencil-outline', onPress: () => setDialog('rename'), testID: Testids.seriesDetail.rename },
          { label: t('series.detail.merge'), icon: 'call-merge', onPress: () => setDialog('merge'), testID: Testids.seriesDetail.merge },
          { label: t('series.detail.delete'), icon: 'trash-can-outline', destructive: true, onPress: () => setDialog('delete'), testID: Testids.seriesDetail.delete },
        ]}
      />

      <View style={{ gap: spacing.sm }}>
        <Text variant="stamp" color="accent">
          {t('series.detail.eyebrow')}
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
        <Heading level={2}>{t('series.detail.readingOrder')}</Heading>
        {slots.length ? (
          <SeriesBookList seriesName={series.name} slots={slots} onOpenBook={(id) => router.push({ pathname: '/book/[id]', params: { id: String(id) } })} onAddGap={addAt} />
        ) : (
          <EmptyState
            illustration={<Booky expression="sleepy" size={80} />}
            title={t('series.detail.emptyTitle')}
            message={t('series.detail.emptyMessage')}
            action={{ label: t('series.detail.addFirst'), onPress: () => addAt(1) }}
          />
        )}
        {firstMissing == null && progress.total != null && series.totalCount == null ? (
          <Text variant="caption" color="inkMuted">
            {t('series.detail.noGapsYet')}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Heading level={2}>{t('series.detail.length')}</Heading>
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
          show({ message: t('series.detail.renamed', { name }) });
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
            show({ message: t('series.detail.merged', { name: target.name }) });
          }
        }}
      />
      <ConfirmDialog
        visible={dialog === 'delete'}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title={t('series.deleteDialog.title')}
        message={books.length ? t('series.deleteDialog.message', { books: booksText(books.length), name: series.name }) : t('series.deleteDialog.messageEmpty', { name: series.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('series.deleteDialog.keep')}
        destructive
        busy={deleting}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await actions.remove();
            setDialog(null);
            router.replace('/series');
            show({ message: t('series.detail.deleted', { name: series.name }) });
          } catch (e) {
            console.error('Could not delete the series', e);
            setDeleting(false);
            show({ message: t('series.detail.deleteFailed') });
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
        title={t('series.detail.notFoundTitle')}
        message={t('series.detail.notFoundMessage')}
        action={{ label: t('series.detail.allSeries'), onPress: () => router.replace('/series') }}
      />
    </Screen>
  );
}

/** `/series/[id]`: a series as a shelf, in order, with its gaps (P04-05). */
export function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const seriesId = parseSeriesId(id);
  const state = useSeries(seriesId);
  // The page draws this series' gaps: Booky's gap tip is not floated over it.
  useBookyTopic(seriesId == null ? null : `series:${seriesId}`);
  if (state.status === 'missing') return <SeriesMissing />;
  if (state.status === 'loading') {
    return (
      <Screen pageState="loading" centered edges={[...EDGES]}>
        <Text color="inkMuted" align="center">
          {t('series.detail.loading')}
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
