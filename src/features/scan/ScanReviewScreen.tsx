import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { candidateFacts } from '@/components/book/CandidateCard';
import { CoverImage } from '@/components/book/CoverImage';
import { Booky, useBooky } from '@/components/booky';
import { Button, CatalogueCard, EmptyState, Heading, IconButton, Screen, Stamp, Text, useSnackbar } from '@/components/ui';
import { useDatabase } from '@/db';
import { joinNames } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { updateSession } from './sessionStore';
import { dropTrayItem, removeTrayItems, useTray, type TrayItem } from './useBatchScan';
import { saveCandidate } from './useSaveCandidate';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;
const books = (n: number) => (n === 1 ? '1 book' : `${n} books`);

function backToScan() {
  if (router.canGoBack()) router.back();
  else router.replace('/scan');
}

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
          <Stamp label="Needs a choice" tone="warn" rotate={-3} />
          <Text style={styles.fill}>{item.label}</Text>
        </View>
      )}
      <View style={[styles.row, styles.end, { gap: spacing.sm }]}>
        {item.status === 'needs-choice' ? (
          <Button variant="secondary" label="Choose the edition" onPress={choose} testID={Testids.scanReview.choose} />
        ) : null}
        <Button
          variant="ghost"
          label="Drop"
          accessibilityLabel={`Drop ${item.label} from the tray`}
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
  const { showTip } = useBooky();
  const { show } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const ready = tray.filter((i): i is TrayItem & { candidate: NonNullable<TrayItem['candidate']> } => i.status === 'ready' && i.candidate !== null);
  const waiting = tray.length - ready.length;

  const saveAll = async () => {
    setSaving(true);
    const saved: string[] = [];
    let count = 0;
    try {
      for (const item of ready) {
        const result = await saveCandidate(db, item.candidate);
        saved.push(item.id);
        count = result.count;
      }
    } catch (e) {
      console.error('Could not save the tray', e);
      show({ message: 'Sorry, I couldn’t save every book. The ones left are still in the tray.' });
    } finally {
      removeTrayItems(saved);
      setSaving(false);
    }
    if (saved.length) {
      showTip({ expression: 'excited', message: `Shelved ${books(saved.length)}! That’s ${books(count)} in all.` });
      // Back to the tab shell underneath (not a second one on top of it), then to the Shelf.
      if (router.canDismiss()) router.dismissAll();
      router.navigate('/');
    }
  };

  return (
    <Screen testID={Testids.scanReview.root} scroll={false} edges={[...EDGES]} contentStyle={{ padding: 0, gap: 0, flex: 1 }}>
      <ScrollView style={styles.fill} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ gap: spacing.xs }}>
          <View style={[styles.row, { marginTop: -spacing.sm, marginHorizontal: -spacing.sm }]}>
            <IconButton icon="arrow-left" accessibilityLabel="Back to scanning" onPress={backToScan} />
          </View>
          <Heading level={1}>Review your scans</Heading>
          <Text color="inkMuted">
            {tray.length ? 'Check each book, choose an edition where I wasn’t sure, and drop any you don’t want.' : ' '}
          </Text>
        </View>
        {tray.length ? (
          <View role="list" aria-label="Scanned books" style={{ gap: spacing.lg }}>
            {tray.map((item) => (
              <TrayRow key={item.id} item={item} />
            ))}
          </View>
        ) : (
          <View testID={Testids.scanReview.empty}>
            <EmptyState
              illustration={<Booky expression="sleepy" size={96} />}
              title="The tray is empty"
              message="Turn on “Scan several” on the Scan tab and every book you scan waits here."
              action={{ label: 'Back to scanning', onPress: backToScan }}
            />
          </View>
        )}
      </ScrollView>
      {tray.length ? (
        <View style={[styles.bar, { borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm }]}>
          {waiting ? (
            <Text variant="caption" color="inkMuted" style={styles.fill}>
              {`${books(waiting)} still ${waiting === 1 ? 'needs' : 'need'} an edition and will stay in the tray.`}
            </Text>
          ) : null}
          <Button
            label={ready.length ? `Save ${books(ready.length)}` : 'Nothing ready to save'}
            onPress={() => void saveAll()}
            disabled={!ready.length}
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
