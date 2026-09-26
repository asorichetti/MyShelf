import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { formatLabels } from '@/components/book/BookForm';
import { Booky, HelpButton } from '@/components/booky';
import { DuplicateSheet } from '@/components/scan/DuplicateSheet';
import { EditionRow } from '@/components/scan/EditionRow';
import { WorkGroup } from '@/components/scan/WorkGroup';
import { Button, Chip, EmptyState, Heading, Screen, Text, TopBar, useSnackbar } from '@/components/ui';
import { useBottomObstacle } from '@/components/ui/layers';
import { genresRepo, useDatabase } from '@/db';
import { languageName, type BookDetail } from '@/domain';
import { goBackOr } from '@/features/navigation/goBack';
import { t } from '@/i18n';
import type { BookCandidate } from '@/services/metadata';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { prefillFromCandidate, prefillFromScan, putPrefill } from './prefill';
import { endSession, getSession } from './sessionStore';
import { resolveTrayItem } from './useBatchScan';
import { useDuplicateCheck } from './useDuplicateCheck';
import { useEditionPicker } from './useEditionPicker';
import { useSaveCandidate } from './useSaveCandidate';


const EDGES = ['top', 'bottom', 'left', 'right'] as const;
const SHOWN = 20;

const backToScan = () => goBackOr('/scan');

/** `/scan/pick?session=<id>` (P03-08): choose the edition in your hands, then save it. */
export function EditionPickerScreen() {
  const { session: sessionId } = useLocalSearchParams<{ session?: string }>();
  const [session] = useState(() => getSession(typeof sessionId === 'string' ? sessionId : null));
  const picker = useEditionPicker(session);
  const db = useDatabase();
  const theme = useTheme();
  const { colors, spacing, sizes, radii } = theme;
  const { show } = useSnackbar();
  const { check } = useDuplicateCheck();
  const { save } = useSaveCandidate();
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<{ existing: BookDetail[]; candidate: BookCandidate } | null>(null);
  const [shown, setShown] = useState<Record<string, number>>({});
  // Booky's help tip sits above the bottom bar, never over "This is my edition" (P07-07).
  const { attach: attachBar, onLayout: layoutBar } = useBottomObstacle(session != null);

  if (!session) {
    return (
      <Screen testID={Testids.picker.root} centered edges={[...EDGES]}>
        <View testID={Testids.picker.expired}>
          <EmptyState
            illustration={<Booky expression="sleepy" size={96} />}
            headingLevel={1}
            title={t('editions.picker.expiredTitle')}
            message={t('editions.picker.expiredMessage')}
            action={{ label: t('scan.backToScanning'), onPress: backToScan }}
          />
        </View>
      </Screen>
    );
  }

  const saveIt = async (candidate: BookCandidate) => {
    setSaving(true);
    try {
      const saved = await save(candidate);
      endSession(session.id);
      setDuplicates(null);
      router.replace({ pathname: '/book/[id]', params: { id: String(saved.id) } });
    } catch (e) {
      console.error('Could not save the book', e);
      show({ message: t('common.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    const candidate = picker.chosen();
    if (!candidate) return;
    if (session.trayItemId) {
      resolveTrayItem(session.trayItemId, candidate);
      endSession(session.id);
      backToScan();
      return;
    }
    if (review) {
      const genres = (await genresRepo.listGenres(db)).map((g) => g.name);
      const id = putPrefill(prefillFromCandidate(candidate, genres));
      endSession(session.id);
      router.replace({ pathname: '/book/new', params: { prefill: id } });
      return;
    }
    const existing = await check(candidate);
    if (existing.length) {
      setDuplicates({ existing, candidate });
      return;
    }
    await saveIt(candidate);
  };

  const addManually = () => {
    const id = putPrefill(prefillFromScan({ isbn13: session.isbn13, guess: session.guess }));
    endSession(session.id);
    router.replace({ pathname: '/book/new', params: { prefill: id } });
  };

  const { single, groups, available, filters } = picker;
  const intro = single
    ? t('editions.picker.introSingle')
    : t('editions.picker.introMany', { count: groups.length });

  return (
    <Screen testID={Testids.picker.root} scroll={false} edges={[...EDGES]} contentStyle={{ padding: 0, gap: 0, flex: 1 }}>
      <ScrollView style={styles.fill} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ gap: spacing.xs }}>
          <TopBar onBack={backToScan} backLabel={t('scan.backToScanning')}>
            <HelpButton screen="editions" />
          </TopBar>
          <Heading level={1}>{single ? t('editions.picker.titleSingle') : t('editions.picker.titleMany')}</Heading>
          <Text color="inkMuted">{intro}</Text>
        </View>
        <View style={[styles.hint, { gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.accentContainer }]}>
          <MaterialCommunityIcons name="book-open-page-variant-outline" size={sizes.icon} color={colors.onAccentContainer} aria-hidden />
          <Text color="onAccentContainer" style={styles.fill}>
            {t('editions.picker.copyrightHint')}
          </Text>
        </View>

        {!single && (available.formats.length > 1 || available.languages.length > 1) ? (
          <View style={{ gap: spacing.xs }}>
            {available.formats.length > 1 ? (
              <View role="radiogroup" aria-label={t('bookFields.format')} testID={Testids.picker.filterFormat} style={[styles.wrap, { columnGap: spacing.sm }]}>
                <Chip label={t('editions.picker.anyFormat')} role="radio" selected={!filters.format} onPress={() => picker.setFilters({ format: null })} />
                {available.formats.map((f) => (
                  <Chip key={f} label={formatLabels[f]} role="radio" selected={filters.format === f} onPress={() => picker.setFilters({ format: f })} />
                ))}
              </View>
            ) : null}
            {available.languages.length > 1 ? (
              <View role="radiogroup" aria-label={t('bookFields.language')} testID={Testids.picker.filterLanguage} style={[styles.wrap, { columnGap: spacing.sm }]}>
                <Chip label={t('editions.picker.anyLanguage')} role="radio" selected={!filters.language} onPress={() => picker.setFilters({ language: null })} />
                {available.languages.map((l) => (
                  <Chip key={l} label={languageName(l)} role="radio" selected={filters.language === l} onPress={() => picker.setFilters({ language: l })} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {single ? (
          <View role="radiogroup" aria-label={t('editions.picker.yourBook')}>
            <EditionRow edition={single} selected={picker.selected === single} onSelect={() => picker.select(single)} />
          </View>
        ) : (
          groups.map((g) => {
            const load = picker.loads[g.key];
            const editions = picker.editionsOf(g.key);
            const limit = shown[g.key] ?? SHOWN;
            const message =
              load?.status === 'error'
                ? t('editions.picker.loadFailed')
                : load?.status === 'ready' && !editions.length
                  ? t('editions.picker.noMatch')
                  : null;
            return (
              <WorkGroup key={g.key} work={g.work} expanded={picker.expanded.has(g.key)} onToggle={() => picker.toggle(g.key)} loading={load?.status === 'loading'} message={message}>
                {editions.slice(0, limit).map((e) => (
                  <EditionRow key={`${e.source}:${e.sourceId}`} edition={e} selected={picker.selected === e} onSelect={() => picker.select(e)} />
                ))}
                {editions.length > limit ? (
                  <Button variant="ghost" label={t('editions.picker.showMore', { count: Math.min(SHOWN, editions.length - limit) })} onPress={() => setShown((s) => ({ ...s, [g.key]: limit + SHOWN }))} />
                ) : null}
              </WorkGroup>
            );
          })
        )}

        {!session.trayItemId ? (
          <Chip
            label={t('editions.picker.reviewBeforeSaving')}
            role="checkbox"
            selected={review}
            onPress={() => setReview((r) => !r)}
            testID={Testids.picker.review}
            accessibilityLabel={t('editions.picker.reviewBeforeSavingLabel')}
          />
        ) : null}
      </ScrollView>

      <View ref={attachBar} onLayout={layoutBar} style={[styles.actions, { borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm }]}>
        <Button variant="ghost" label={t('editions.picker.none')} onPress={addManually} testID={Testids.picker.none} disabled={saving} />
        <Button
          label={session.trayItemId ? t('editions.picker.useThisEdition') : t('editions.picker.thisIsMyEdition')}
          onPress={() => void confirm()}
          disabled={!picker.selected}
          loading={saving}
          testID={Testids.picker.confirm}
          icon={<MaterialCommunityIcons name="check" size={sizes.icon} color={colors.onPrimary} />}
        />
      </View>

      <DuplicateSheet
        visible={duplicates !== null}
        existing={(duplicates?.existing ?? []).map((b) => ({
          title: b.title,
          authors: b.authors.map((a) => a.name),
          publicationYear: b.publicationYear,
          coverUri: b.coverUri,
          isbn13: b.isbn13,
        }))}
        busy={saving}
        onCancel={() => setDuplicates(null)}
        onOpen={() => {
          const first = duplicates?.existing[0];
          setDuplicates(null);
          endSession(session.id);
          if (first) router.replace({ pathname: '/book/[id]', params: { id: String(first.id) } });
        }}
        onAddCopy={() => duplicates && void saveIt(duplicates.candidate)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'flex-start' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1 },
});
