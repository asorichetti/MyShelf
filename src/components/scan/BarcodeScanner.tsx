import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookyBubble, useInlineTip } from '@/components/booky';
import { IconButton } from '@/components/ui';
import { bookBarcodeTypes } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { Viewfinder } from './Viewfinder';

/** After this long with no barcode, Booky suggests reading the cover (PLAN §8). */
export const NO_READ_TIP_MS = 8000;

export interface BarcodeScannerProps {
  /** Every read, as the camera reports it; the scan session filters repeats and non-books. */
  onBarcode: (read: { type: string; data: string }) => void;
  /** Stops reading while a lookup runs or a result is on screen. */
  paused: boolean;
  onReadCover: () => void;
}

/**
 * The live barcode scanner (P03-03): a camera listening for EAN-13, EAN-8
 * and UPC-A, under a library-card viewfinder, with a torch toggle. After
 * eight seconds with no read Booky suggests the cover instead.
 */
export function BarcodeScanner({ onBarcode, paused, onReadCover }: BarcodeScannerProps) {
  const { spacing, radii } = useTheme();
  const [torch, setTorch] = useState(false);
  // Booky's tip belongs to one stretch of scanning: a read or a pause starts a new one.
  const [reads, setReads] = useState(0);
  const stretch = `${paused}:${reads}`;
  const [slowStretch, setSlowStretch] = useState<string | null>(null);
  const slow = slowStretch === stretch;
  // Booky's "No barcode?" tip: once a session, and only while Booky is Helpful.
  const tip = useInlineTip({ type: 'scan-idle' }, slow && !paused);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setSlowStretch(stretch), NO_READ_TIP_MS);
    return () => clearTimeout(timer);
  }, [paused, stretch]);

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    setReads((n) => n + 1);
    onBarcode({ type: result.type, data: result.data });
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.frame, { borderRadius: radii.lg }]}>
        <CameraView
          testID={Testids.scan.camera}
          accessibilityLabel={t('scan.barcode.cameraLabel')}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: [...bookBarcodeTypes] }}
          onBarcodeScanned={paused ? undefined : onBarcodeScanned}
        />
        <Viewfinder hint={t('scan.barcode.hint')} active={!paused} />
        <View style={[styles.torch, { top: spacing.sm, right: spacing.sm }]}>
          <IconButton
            icon={torch ? 'flashlight-off' : 'flashlight'}
            variant="filled"
            accessibilityLabel={torch ? t('scan.barcode.torchOff') : t('scan.barcode.torchOn')}
            onPress={() => setTorch((t) => !t)}
            testID={Testids.scan.torch}
          />
        </View>
      </View>
      {tip ? (
        <BookyBubble
          expression={tip.tip.expression}
          message={tip.text}
          actions={[{ label: tip.action?.label ?? t('scan.barcode.readCover'), onPress: onReadCover, testID: Testids.scan.readCoverInstead }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 3 / 4, overflow: 'hidden', backgroundColor: 'black' },
  torch: { position: 'absolute' },
});
