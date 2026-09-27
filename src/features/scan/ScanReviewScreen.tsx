import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { candidateFacts } from '@/components/book/CandidateCard';
import { CoverImage } from '@/components/book/CoverImage';
import { Booky, bookCount, useBooky } from '@/components/booky';
import { Button, CatalogueCard, EmptyState, Heading, Screen, Stamp, Text, TopBar, useFloatClearance, useSnackbar } from '@/components/ui';
import { useDatabase } from '@/db';
import { joinNames } from '@/domain';
import { goBackOr } from '@/features/navigation/goBack';
import { useMounted } from '@/hooks/useMounted';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { updateSession } from './sessionStore';
import {
  dropTrayItem,
  getTray,
  isTrayItemReady,
  keepTrayItem,
  removeTrayCopy,
  removeTrayItems,
  setTrayCopies,
  setTrayOnShelf,
  useTray,
  type TrayItem,
} from './useBatchScan';
import { findDuplicates } from './useDuplicateCheck';
import { saveCandidate } from './useSaveCandidate';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

const backToScan = () => goBackOr('/scan');

function TrayRow({ item }: { item: TrayItem }) {
  const { spacing, sizes, colors } = useTheme();
  const choose = () => {
    if (!item.sessionId) return;
    updateSession(item.sessionId, { trayItemId: item.id });
    router.navigate({ pathname: '/scan/pick', params: { session: item.sessionId } });
  };
  return (
    <View testID={Testids.scanReview.item} role="listitem" style={{ gap: spacing.xs }}>
      {item.candidate ? (
        <CatalogueCard
          title={item.candidate.title}
          authors={joinNames(item.candidate.authors) || null}
          isbn={item.candidate.isbn13 ?? item.candidate.isbn10}
          cover={<CoverImage uri={item.candidate.coverUrl} title={item.candidate.title} author={item.candidate.authors[0]} size="thumb" />}
          meta={
            <Text variant="caption" color="inkMuted">
              {candidateFacts(item.candidate).join(' · ')}
            </Text>
          }
        />
      ) : (
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Stamp label={t('scanReview.needsChoice')} tone="warn" rotate={-3} />
          <Text style={styles.fill}>{item.label}</Text>
        </View>
      )}
      {item.onShelf ? (
        <View style={[styles.row, { gap: spacing.sm }]}>
          <View testID={Testids.scanReview.onShelf}>
            <Stamp label={t('scanReview.onShelf')} tone="warn" rotate={-3} />
          </View>
          <Text variant="caption" color="inkMuted" style={styles.fill}>
            {item.keep ? t('scanReview.keeping') : t('scanReview.onShelfCount', { count: item.onShelf })}
          </Text>
        </View>
      ) : null}
      {item.copies > 1 ? (
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Text variant="bodyStrong" style={styles.fill} testID={Testids.scanReview.copies}>
            {t('scanReview.copies', { count: item.copies })}
          </Text>
          <Button
            variant="ghost"
            label={t('scanReview.removeCopy')}
            accessibilityLabel={t('scanReview.removeCopyLabel', { title: item.label })}
            onPress={() => removeTrayCopy(item.id)}
            testID={Testids.scanReview.removeCopy}
            icon={<MaterialCommunityIcons name="minus" size={sizes.icon} color={colors.primary} />}
          />
        </View>
      ) : null}
      <View style={[styles.row, styles.end, { gap: spacing.sm }]}>
        {item.status === 'needs-choice' ? (
          <Button variant="secondary" label={t('scanReview.choose')} onPress={choose} testID={Testids.scanReview.choose} />
        ) : null}
        {item.onShelf && !item.keep ? (
          <Button
            variant="secondary"
            label={t('scanReview.keep')}
            accessibilityLabel={t('scanReview.keepLabel', { title: item.label })}
            onPress={() => keepTrayItem(item.id)}
            testID={Testids.scanReview.keep}
          />
        ) : null}
        <Button
          variant="ghost"
          label={t('scanReview.drop')}
          accessibilityLabel={t('scanReview.dropLabel', { title: item.label })}
          onPress={() => dropTrayItem(item.id)}
          testID={Testids.scanReview.drop}
          icon={<MaterialCommunityIcons name="close" size={sizes.icon} color={colors.primary} />}
        />
      </View>
    </View>
  );
}

/** `/scan/review` (P03-12): confirm, fix or drop each scanned book, then shelve them all at once. */
export function ScanReviewScreen() {
  const tray = useTray();
  const db = useDatabase();
  const { spacing, colors, sizes } = useTheme();
  const { emit } = useBooky();
  const { show } = useSnackbar();
  const mounted = useMounted();
  const [saving, setSaving] = useState(false);
  // A second tap while saving must not save the tray again.
  const busy = useRef(false);
  // Room for Booky's floating tip below the list.
  const { attach: attachRoom, onLayout: layoutRoom, clearance } = useFloatClearance();
  const ready = tray.filter(isTrayItemReady);
  const readyBooks = ready.reduce((n, i) => n + i.copies, 0);
  const waiting = tray.filter((i) => i.status === 'needs-choice').length;
  const onShelfUndecided = tray.filter((i) => i.status === 'ready' && i.onShelf && !i.keep).length;

  // Each book with an edition is checked against the shelf once (again after another edition is chosen).
  const needsCheck = (i: TrayItem) => i.status === 'ready' && i.candidate !== null && i.onShelf === null;
  const unchecked = tray.filter(needsCheck).map((i) => i.id).join(' ');
  useEffect(() => {
    if (!unchecked) return;
    for (const item of getTray().filter(needsCheck)) {
      const candidate = item.candidate!;
      findDuplicates(db, candidate)
        .then((copies) => setTrayOnShelf(item.id, candidate, copies.length))
        .catch((e) => {
          console.warn('Could not check the shelf for a scanned book', e);
          setTrayOnShelf(item.id, candidate, 0);
        });
    }
  }, [db, unchecked]);

  const saveAll = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    const saved: string[] = [];
    let books = 0;
    let count = 0;
    try {
      for (const item of ready) {
        for (let copy = 0; copy < item.copies; copy++) {
          try {
            const result = await saveCandidate(db, item.candidate);
            books++;
            count = result.count;
          } catch (e) {
            // The copies already saved leave the tray; the rest stay for another try.
            if (copy > 0) setTrayCopies(item.id, item.copies - copy);
            throw e;
          }
        }
        saved.push(item.id);
      }
    } catch (e) {
      console.error('Could not save the tray', e);
      show({ message: t('scanReview.saveFailed') });
    } finally {
      removeTrayItems(saved);
      busy.current = false;
      setSaving(false);
    }
    if (books) {
      void emit({ type: 'book-added', variant: 'batch', vars: { saved: bookCount(books), books: bookCount(count) } });
      if (!mounted.current) return;
      // Back to the tab shell underneath (not a second one on top of it), then to the Shelf.
      if (router.canDismiss()) router.dismissAll();
      router.navigate('/');
    }
  };

  return (
    <Screen testID={Testids.scanReview.root} scroll={false} edges={[...EDGES]} contentStyle={{ padding: 0, gap: 0, flex: 1 }}>
      <ScrollView
        ref={attachRoom}
        onLayout={layoutRoom}
        style={styles.fill}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl + clearance }}
      >
        <View style={{ gap: spacing.xs }}>
          <TopBar onBack={backToScan} backLabel={t('scan.backToScanning')} />
          <Heading level={1}>{t('scanReview.title')}</Heading>
          <Text color="inkMuted">
            {tray.length ? t('scanReview.intro') : ' '}
          </Text>
        </View>
        {tray.length ? (
          <View role="list" aria-label={t('scanReview.listLabel')} style={{ gap: spacing.lg }}>
            {tray.map((item) => (
              <TrayRow key={item.id} item={item} />
            ))}
          </View>
        ) : (
          <View testID={Testids.scanReview.empty}>
            <EmptyState
              testID={Testids.emptyState.root}
              illustration={<Booky expression="sleepy" size={96} />}
              title={t('scanReview.emptyTitle')}
              message={t('scanReview.emptyMessage')}
              action={{ label: t('scan.backToScanning'), onPress: backToScan }}
            />
          </View>
        )}
      </ScrollView>
      {tray.length ? (
        <View style={[styles.bar, { borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm }]}>
          {waiting || onShelfUndecided ? (
            <View style={styles.fill}>
              {waiting ? (
                <Text variant="caption" color="inkMuted">
                  {t('scanReview.waiting', { count: waiting })}
                </Text>
              ) : null}
              {onShelfUndecided ? (
                <Text variant="caption" color="inkMuted">
                  {t('scanReview.onShelfWaiting', { count: onShelfUndecided })}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Button
            label={readyBooks ? t('scanReview.save', { count: readyBooks }) : t('scanReview.nothingReady')}
            onPress={() => void saveAll()}
            disabled={!readyBooks}
            loading={saving}
            testID={Testids.scanReview.saveAll}
            icon={<MaterialCommunityIcons name="check" size={sizes.icon} color={colors.onPrimary} />}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  end: { justifyContent: 'flex-end' },
  bar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1 },
});
