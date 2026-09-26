import { CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookyBubble } from '@/components/booky';
import { Button, Text } from '@/components/ui';
import type { OcrResult } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { Viewfinder } from './Viewfinder';
import { TypedCoverTextField } from './WebScanInput';

export interface CoverCaptureProps {
  /** Reads the text on a photo (the recognition service); rejects when unavailable. */
  recognize: (uri: string) => Promise<OcrResult>;
  /** Whether this build has on-device text recognition at all. */
  available: boolean;
  onRecognised: (result: OcrResult, photoUri: string) => void;
  /** Typed cover text, when the phone cannot read the cover itself. */
  onTypeText: (text: string) => void;
  paused: boolean;
}

type Step = { step: 'aim' } | { step: 'review'; uri: string } | { step: 'reading'; uri: string } | { step: 'failed'; uri: string; message: string };

/**
 * "Read the cover" (P03-05): take one photo, check it ("Use this photo" /
 * "Retake"), then read its text on the device. In a build without the text
 * reader the typed cover text stands in, exactly as on the web.
 */
export function CoverCapture({ recognize, available, onRecognised, onTypeText, paused }: CoverCaptureProps) {
  const { spacing, radii } = useTheme();
  const camera = useRef<CameraView>(null);
  const [state, setState] = useState<Step>({ step: 'aim' });

  if (!available) {
    return (
      <View style={{ gap: spacing.md }}>
        <Text color="inkMuted">{t('scan.cover.unavailable')}</Text>
        <TypedCoverTextField onSubmit={onTypeText} disabled={paused} />
      </View>
    );
  }

  const capture = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) setState({ step: 'review', uri: photo.uri });
  };

  const read = async (uri: string) => {
    setState({ step: 'reading', uri });
    try {
      const result = await recognize(uri);
      setState({ step: 'aim' });
      onRecognised(result, uri);
    } catch {
      setState({ step: 'failed', uri, message: t('scan.cover.readFailed') });
    }
  };

  if (state.step === 'aim') {
    return (
      <View style={{ gap: spacing.md }}>
        <View style={[styles.frame, { borderRadius: radii.lg }]}>
          <CameraView ref={camera} testID={Testids.scan.camera} accessibilityLabel={t('scan.cover.cameraLabel')} style={StyleSheet.absoluteFill} facing="back" />
          <Viewfinder hint={t('scan.cover.hint')} active={false} />
        </View>
        <Button label={t('scan.cover.takePhoto')} onPress={() => void capture()} disabled={paused} testID={Testids.scan.capture} block />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Image source={{ uri: state.uri }} alt={t('scan.cover.photoAlt')} contentFit="contain" style={[styles.frame, { borderRadius: radii.lg }]} />
      {state.step === 'failed' ? <BookyBubble expression="concerned" message={state.message} /> : null}
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Button variant="secondary" label={t('scan.cover.retake')} onPress={() => setState({ step: 'aim' })} disabled={state.step === 'reading'} testID={Testids.scan.retake} />
        <Button
          label={state.step === 'failed' ? t('common.tryAgain') : t('scan.cover.usePhoto')}
          onPress={() => void read(state.uri)}
          loading={state.step === 'reading'}
          testID={Testids.scan.usePhoto}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 2 / 3, overflow: 'hidden' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
});
