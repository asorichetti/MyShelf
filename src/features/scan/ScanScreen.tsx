import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CoverImage } from '@/components/book/CoverImage';
import { BookyBubble, HelpButton, tipById, useOptionalBooky } from '@/components/booky';
import { ScanHelp } from '@/components/scan/ScanHelp';
import { ScanModeSwitch, type ScanMode } from '@/components/scan/ScanModeSwitch';
import { ScannerHost } from '@/components/scan/ScannerHost';
import { ScanTray } from '@/components/scan/ScanTray';
import { CatalogueCard, Chip, Heading, Screen, Text } from '@/components/ui';
import { joinNames, type OcrQuery, type OcrResult } from '@/domain';
import { isE2eEnabled } from '@/features/e2e/e2eFlag';
import { t } from '@/i18n';
import { ocrAvailable, recognizeText } from '@/services/recognition';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { choosePhoto } from './choosePhoto';
import { logOcrResult } from './ocrLog';
import { prefillFromScan, putPrefill } from './prefill';
import { onInjectedScan, takeInjectedScan } from './scanInjector';
import { endSession } from './sessionStore';
import { discardPhoto } from './tempPhoto';
import { addToTray, addTrayCopy, trayBookCount, trayItemFor, useTray } from './useBatchScan';
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
  // Cover words to correct and search with, after a cover photo found nothing (null: the camera).
  const [typedCover, setTypedCover] = useState<string | null>(null);
  const tray = useTray();
  const permission = usePermission();
  const booky = useOptionalBooky();
  const emit = booky?.emit;
  const memoryVersion = booky?.memoryVersion;

  // Booky's first-visit tip ("Point me at the barcode on the back cover."), once ever, after the onboarding.
  useEffect(() => {
    void emit?.({ type: 'scan-opened' });
  }, [emit, memoryVersion]);

  const setMode = useCallback((m: ScanMode) => {
    remembered.mode = m;
    setModeState(m);
  }, []);
  const setBatch = (b: boolean) => {
    remembered.batch = b;
    setBatchState(b);
  };

  const onFound = useCallback((session: ScanSession) => {
    // The same ISBN again: a second copy is added only when the user says so.
    const repeat = trayItemFor(session);
    if (repeat) {
      endSession(session.id);
      const title = repeat.candidate?.title ?? repeat.label;
      setTrayNotice({
        expression: 'thinking',
        message: t('scan.screen.alreadyInTray', { title }),
        action: {
          label: t('scan.screen.addCopy'),
          accessibilityLabel: t('scan.screen.addCopyLabel', { title }),
          testID: Testids.scan.addCopy,
          onPress: () => {
            addTrayCopy(repeat.id);
            setTrayNotice({ expression: 'excited', message: t('scan.screen.addedToTray', { title }) });
          },
        },
      });
      return;
    }
    const item = addToTray(session);
    setTrayNotice({
      expression: 'excited',
      message: item.status === 'ready' ? t('scan.screen.addedToTray', { title: item.label }) : t('scan.screen.needsChoice', { title: item.label }),
    });
  }, []);
  const scan = useScanSession({ onFound: batch ? onFound : undefined });
  const { state, submitIsbn, submitCoverText, submitOcr, resume } = scan;

  const onOcr = useCallback(
    (result: OcrResult, photoUri: string) => {
      // E2E builds log what the text reader saw, for recording OCR fixtures (scripts/record-mlkit-fixture.mjs).
      if (isE2eEnabled()) logOcrResult(result);
      submitOcr(result, photoUri);
    },
    [submitOcr],
  );
  const typeWords = (text: string) => {
    setMode('cover');
    setTypedCover(text);
    resume();
  };

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

  const scanner = (
    <ScannerHost
      mode={mode}
      paused={scan.paused}
      permission={{ state: permission.state, request: () => void permission.request(), openSettings: permission.openSettings }}
      recognize={recognizeText}
      ocrAvailable={ocrAvailable}
      onBarcode={scan.onBarcode}
      onIsbnText={submitIsbn}
      onCoverText={submitCoverText}
      onOcr={onOcr}
      onModeChange={setMode}
      choosePhoto={choosePhoto}
      typedCover={typedCover}
      onTypedCoverDone={() => setTypedCover(null)}
      onDiscardPhoto={discardPhoto}
    />
  );
  // Booky's answer for a cover photo shows above the tall cover camera, where it is seen.
  const resultsFirst = mode === 'cover' && ocrAvailable;
  const results = (
    <>
      {state.phase === 'looking-up' ? (
        <BookyBubble
          testID={Testids.scan.lookupSheet}
          expression="thinking"
          message={state.label}
          actions={[{ label: t('common.cancel'), onPress: scan.cancel, testID: Testids.scan.lookupCancel }]}
        />
      ) : null}
      {state.phase === 'not-found' ? (
        <View testID={Testids.scan.notFound}>
          <BookyBubble
            expression="concerned"
            title={state.kind === 'isbn' ? t('scan.screen.noMatchIsbn') : t('scan.screen.noMatchCover')}
            message={tipById('lookup-none-scan').text}
            actions={[
              { label: t('scan.screen.addByHand'), onPress: () => addManually(state.isbn13, state.guess), testID: Testids.scan.addManually },
              ...(state.kind === 'cover' && state.typed != null
                ? [{ label: t('scan.screen.typeWords'), onPress: () => typeWords(state.typed ?? ''), testID: Testids.scan.typeWords }]
                : []),
              state.kind === 'isbn'
                ? {
                    label: t('scan.screen.readCoverInstead'),
                    onPress: () => {
                      setMode('cover');
                      resume();
                    },
                    testID: Testids.scan.readCoverInstead,
                  }
                : { label: t('common.tryAgain'), onPress: resume, testID: Testids.scan.resume },
            ]}
          />
        </View>
      ) : null}
      {state.phase === 'not-book' ? (
        <View testID={Testids.scan.notBookBarcode}>
          <BookyBubble expression="thinking" message={scanMessages.notBook} actions={[{ label: t('scan.screen.keepScanning'), onPress: resume, testID: Testids.scan.resume }]} />
        </View>
      ) : null}
      {state.phase === 'error' ? (
        <View role="alert" testID={Testids.scan.error}>
          <BookyBubble
            expression="concerned"
            message={state.message}
            actions={[
              ...(state.typed != null
                ? [
                    {
                      label: state.typed ? t('scan.screen.typeWords') : t('scan.permission.typeCoverText'),
                      onPress: () => typeWords(state.typed ?? ''),
                      testID: Testids.scan.typeWords,
                    },
                  ]
                : []),
              { label: t('common.tryAgain'), onPress: resume, testID: Testids.scan.resume },
            ]}
          />
        </View>
      ) : null}
    </>
  );

  return (
    <Screen testID={Testids.scan.root}>
      <View style={[styles.titleRow, { gap: spacing.sm }]}>
        <Heading level={1} testID={Testids.scan.title} style={styles.fill}>
          {t('scan.screen.title')}
        </Heading>
        <HelpButton screen="scan" onMore={() => setHelp(true)} />
      </View>
      <ScanModeSwitch mode={mode} onChange={setMode} />

      {resultsFirst ? results : null}
      {scanner}
      {resultsFirst ? null : results}

      {notice && state.phase === 'ready' ? (
        <View testID={Testids.scan.notice}>
          <BookyBubble
            expression={notice.expression}
            message={notice.message}
            actions={notice.action ? [notice.action] : undefined}
            onDismiss={() => {
              setTrayNotice(null);
              scan.dismissNotice();
            }}
          />
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Chip
          label={t('scan.screen.scanSeveral')}
          role="checkbox"
          selected={batch}
          onPress={() => setBatch(!batch)}
          testID={Testids.scan.batchToggle}
          accessibilityLabel={t('scan.screen.scanSeveralLabel')}
        />
        {batch || tray.length ? <ScanTray count={trayBookCount(tray)} needsChoice={needsChoice} onReview={() => router.navigate('/scan/review')} /> : null}
      </View>

      {scan.lastFound && !batch ? (
        <View style={{ gap: spacing.xs }} testID={Testids.scan.lastScanned}>
          <Text variant="label" color="inkMuted">
            {t('scan.screen.lastFound')}
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
