import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CoverImage } from '@/components/book/CoverImage';
import { BookyBubble } from '@/components/booky';
import { ScanHelp } from '@/components/scan/ScanHelp';
import { ScanModeSwitch, type ScanMode } from '@/components/scan/ScanModeSwitch';
import { ScannerHost } from '@/components/scan/ScannerHost';
import { ScanTray } from '@/components/scan/ScanTray';
import { CatalogueCard, Chip, Heading, IconButton, Screen, Text } from '@/components/ui';
import { joinNames, type OcrQuery } from '@/domain';
import { ocrAvailable, recognizeText } from '@/services/recognition';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { prefillFromScan, putPrefill } from './prefill';
import { onInjectedScan, takeInjectedScan } from './scanInjector';
import { addToTray, useTray } from './useBatchScan';
import { usePermission } from './usePermission';
import { resetLastFound, scanMessages, useScanSession, type ScanNotice } from './useScanSession';

import type { ScanSession } from './sessionStore';

/** Mode and "Scan several" persist for the app session (the tab unmounts when you leave it). */
const remembered: { mode: ScanMode; batch: boolean } = { mode: 'barcode', batch: false };

/** Tests: back to the defaults. */
export function resetScanScreenMemory(): void {
  remembered.mode = 'barcode';
  remembered.batch = false;
  resetLastFound();
}

/** The Scan tab (P03): barcode or cover, a lookup with Booky, then the edition picker. */
export function ScanScreen() {
  const { spacing } = useTheme();
  const [mode, setModeState] = useState<ScanMode>(remembered.mode);
  const [batch, setBatchState] = useState(remembered.batch);
  const [help, setHelp] = useState(false);
  const [trayNotice, setTrayNotice] = useState<ScanNotice | null>(null);
  const tray = useTray();
  const permission = usePermission();

  const setMode = useCallback((m: ScanMode) => {
    remembered.mode = m;
    setModeState(m);
  }, []);
  const setBatch = (b: boolean) => {
    remembered.batch = b;
    setBatchState(b);
  };

  const onFound = useCallback((session: ScanSession) => {
    const item = addToTray(session);
    setTrayNotice({
      expression: 'excited',
      message: item.status === 'ready' ? `Added “${item.label}” to the tray.` : `“${item.label}” needs a choice of edition — pick it when you review.`,
    });
  }, []);
  const scan = useScanSession({ onFound: batch ? onFound : undefined });
  const { state, submitIsbn, submitCoverText, resume } = scan;

  // E2E: a scan injected through /e2e/scan (P03-07) arrives here, exactly where the camera's would.
  useEffect(() => {
    const take = () => {
      const injected = takeInjectedScan();
      if (!injected) return;
      if ('isbn' in injected) submitIsbn(injected.isbn);
      else submitCoverText(injected.text);
    };
    take();
    return onInjectedScan(take);
  }, [submitIsbn, submitCoverText]);

  const addManually = (isbn13: string | null, guess: OcrQuery | null) => {
    const id = putPrefill(prefillFromScan({ isbn13, guess }));
    resume();
    router.navigate({ pathname: '/book/new', params: { prefill: id } });
  };

  const notice = trayNotice ?? scan.notice;
  const needsChoice = tray.filter((i) => i.status === 'needs-choice').length;

  return (
    <Screen testID={Testids.scan.root}>
      <View style={[styles.titleRow, { gap: spacing.sm }]}>
        <Heading level={1} testID={Testids.scan.title} style={styles.fill}>
          Scan a book
        </Heading>
        <IconButton icon="help-circle-outline" accessibilityLabel="How to scan a book" onPress={() => setHelp(true)} testID={Testids.scan.help} />
      </View>
      <ScanModeSwitch mode={mode} onChange={setMode} />

      <ScannerHost
        mode={mode}
        paused={scan.paused}
        permission={{ state: permission.state, request: () => void permission.request(), openSettings: permission.openSettings }}
        recognize={recognizeText}
        ocrAvailable={ocrAvailable}
        onBarcode={scan.onBarcode}
        onIsbnText={submitIsbn}
        onCoverText={submitCoverText}
        onOcr={scan.submitOcr}
        onModeChange={setMode}
      />

      {state.phase === 'looking-up' ? (
        <BookyBubble
          testID={Testids.scan.lookupSheet}
          expression="thinking"
          message={state.label}
          actions={[{ label: 'Cancel', onPress: scan.cancel, testID: Testids.scan.lookupCancel }]}
        />
      ) : null}
      {state.phase === 'not-found' ? (
        <View testID={Testids.scan.notFound}>
          <BookyBubble
            expression="concerned"
            title={state.kind === 'isbn' ? 'No match for that ISBN' : 'No match for that cover'}
            message="I couldn’t find that one. Let’s add it by hand — I’ll fill in what I know."
            actions={[
              { label: 'Add it by hand', onPress: () => addManually(state.isbn13, state.guess), testID: Testids.scan.addManually },
              state.kind === 'isbn'
                ? {
                    label: 'Read the cover instead',
                    onPress: () => {
                      setMode('cover');
                      resume();
                    },
                    testID: Testids.scan.readCoverInstead,
                  }
                : { label: 'Try again', onPress: resume, testID: Testids.scan.resume },
            ]}
          />
        </View>
      ) : null}
      {state.phase === 'not-book' ? (
        <View testID={Testids.scan.notBookBarcode}>
          <BookyBubble expression="thinking" message={scanMessages.notBook} actions={[{ label: 'Keep scanning', onPress: resume, testID: Testids.scan.resume }]} />
        </View>
      ) : null}
      {state.phase === 'error' ? (
        <View role="alert" testID={Testids.scan.error}>
          <BookyBubble expression="concerned" message={state.message} actions={[{ label: 'Try again', onPress: resume, testID: Testids.scan.resume }]} />
        </View>
      ) : null}
      {notice && state.phase === 'ready' ? (
        <View testID={Testids.scan.notice}>
          <BookyBubble
            expression={notice.expression}
            message={notice.message}
            onDismiss={() => {
              setTrayNotice(null);
              scan.dismissNotice();
            }}
          />
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Chip
          label="Scan several"
          role="checkbox"
          selected={batch}
          onPress={() => setBatch(!batch)}
          testID={Testids.scan.batchToggle}
          accessibilityLabel="Scan several books, then review them together"
        />
        {batch || tray.length ? <ScanTray count={tray.length} needsChoice={needsChoice} onReview={() => router.navigate('/scan/review')} /> : null}
      </View>

      {scan.lastFound && !batch ? (
        <View style={{ gap: spacing.xs }} testID={Testids.scan.lastScanned}>
          <Text variant="label" color="inkMuted">
            Last found
          </Text>
          <CatalogueCard
            title={scan.lastFound.title}
            authors={joinNames(scan.lastFound.authors) || null}
            cover={<CoverImage uri={scan.lastFound.coverUrl} title={scan.lastFound.title} author={scan.lastFound.authors[0]} size="thumb" />}
          />
        </View>
      ) : null}

      <ScanHelp visible={help} onClose={() => setHelp(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
});
