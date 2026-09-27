import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import { useRef, useState, type ReactNode } from 'react';
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
  /** Opens the phone's photo picker; resolves with the chosen photo, or null when cancelled. */
  choosePhoto?: () => Promise<string | null>;
  /**
   * Shown in place of the camera when it is not allowed (the permission
   * prompt): choosing a photo still works, since the picker needs no permission.
   */
  cameraBlocked?: ReactNode;
  paused: boolean;
}

type From = 'camera' | 'library';
type Step =
  | { step: 'aim' }
  | { step: 'review'; uri: string; from: From }
  | { step: 'reading'; uri: string; from: From }
  | { step: 'failed'; uri: string; from: From; message: string };

/**
 * "Read the cover" (P03-05): take one photo and check it ("Use this photo" /
 * "Retake"), or choose one from the phone's photos, then read its text on the
 * device. In a build without the text reader the typed cover text stands in,
 * exactly as on the web.
 */
export function CoverCapture({ recognize, available, onRecognised, onTypeText, choosePhoto, cameraBlocked, paused }: CoverCaptureProps) {
  const { spacing, radii, colors, sizes } = useTheme();
  const camera = useRef<CameraView>(null);
  const [state, setState] = useState<Step>({ step: 'aim' });
  const [choosing, setChoosing] = useState(false);

  if (!available) {
    return (
      <View style={{ gap: spacing.md }}>
        <Text color="inkMuted">{t('scan.cover.unavailable')}</Text>
        <TypedCoverTextField onSubmit={onTypeText} disabled={paused} />
      </View>
    );
  }

  const read = async (uri: string, from: From) => {
    setState({ step: 'reading', uri, from });
    try {
      const result = await recognize(uri);
      setState({ step: 'aim' });
      onRecognised(result, uri);
    } catch {
      setState({ step: 'failed', uri, from, message: t('scan.cover.readFailed') });
    }
  };

  const capture = async () => {
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) setState({ step: 'review', uri: photo.uri, from: 'camera' });
    } catch {
      setState({ step: 'aim' });
    }
  };

  const pick = async () => {
    if (!choosePhoto) return;
    setChoosing(true);
    try {
      const uri = await choosePhoto();
      // A chosen photo was already looked at in the picker: read it straight away.
      if (uri) await read(uri, 'library');
    } catch {
      setState({ step: 'aim' });
    } finally {
      setChoosing(false);
    }
  };

  const chooseButton = choosePhoto ? (
    <Button
      variant="secondary"
      label={t('scan.cover.choosePhoto')}
      onPress={() => void pick()}
      disabled={paused || choosing}
      testID={Testids.scan.choosePhoto}
      icon={<MaterialCommunityIcons name="image-outline" size={sizes.icon} color={colors.onPrimaryContainer} />}
      block
    />
  ) : null;

  if (state.step === 'aim') {
    if (cameraBlocked) {
      return (
        <View style={{ gap: spacing.md }}>
          {cameraBlocked}
          {chooseButton}
        </View>
      );
    }
    return (
      <View style={{ gap: spacing.md }}>
        <View style={[styles.frame, { borderRadius: radii.lg }]}>
          <CameraView ref={camera} testID={Testids.scan.camera} accessibilityLabel={t('scan.cover.cameraLabel')} style={StyleSheet.absoluteFill} facing="back" />
          <Viewfinder hint={t('scan.cover.hint')} active={false} />
        </View>
        <Button label={t('scan.cover.takePhoto')} onPress={() => void capture()} disabled={paused} testID={Testids.scan.capture} block />
        {chooseButton}
      </View>
    );
  }

  const fromLibrary = state.from === 'library';
  return (
    <View style={{ gap: spacing.md }}>
      <Image source={{ uri: state.uri }} alt={t('scan.cover.photoAlt')} contentFit="contain" style={[styles.frame, { borderRadius: radii.lg }]} />
      {state.step === 'reading' ? (
        <Text color="inkMuted" align="center" role="status">
          {t('scan.cover.reading')}
        </Text>
      ) : null}
      {state.step === 'failed' ? <BookyBubble expression="concerned" message={state.message} /> : null}
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Button
          variant="secondary"
          label={fromLibrary ? t('scan.cover.chooseAnother') : t('scan.cover.retake')}
          onPress={() => (fromLibrary ? void pick() : setState({ step: 'aim' }))}
          disabled={state.step === 'reading' || choosing}
          testID={Testids.scan.retake}
        />
        <Button
          label={state.step === 'failed' ? t('common.tryAgain') : t('scan.cover.usePhoto')}
          onPress={() => void read(state.uri, state.from)}
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
