import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import type { OcrResult } from '@/domain';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { BarcodeScanner } from './BarcodeScanner';
import { CoverCapture } from './CoverCapture';
import { PermissionPrompt } from './PermissionPrompt';
import { TypedCoverTextField, TypedIsbnField } from './WebScanInput';

export interface ScannerHostProps {
  mode: 'barcode' | 'cover';
  paused: boolean;
  permission: { state: 'loading' | 'undetermined' | 'granted' | 'denied'; request: () => void; openSettings: () => void };
  recognize: (uri: string) => Promise<OcrResult>;
  ocrAvailable: boolean;
  onBarcode: (read: { type: string; data: string }) => void;
  onIsbnText: (text: string) => void;
  onCoverText: (text: string) => void;
  onOcr: (result: OcrResult, photoUri: string) => void;
  onModeChange: (mode: 'barcode' | 'cover') => void;
  /** Cover mode: the phone's photo picker (P03-05). */
  choosePhoto?: () => Promise<string | null>;
  /**
   * Cover words to search with instead, prefilled (what was read off a cover
   * that found nothing); null for the camera. `onTypedCoverDone` goes back to it.
   */
  typedCover?: string | null;
  onTypedCoverDone?: () => void;
  /** Cover mode: deletes a photo taken or chosen but never read (see `CoverCapture`). */
  onDiscardPhoto?: (uri: string) => void;
}

/**
 * The phone's scanner (P03-02, P03-03, P03-05): the camera only once it is
 * allowed; a barcode reader or a cover camera by mode; typing the ISBN is
 * always one tap away. In cover mode a photo can also be chosen from the
 * phone's photos, camera or not. The web build has its own (ScannerHost.web.tsx).
 */
export function ScannerHost(props: ScannerHostProps) {
  const { spacing } = useTheme();
  const { permission, mode, paused } = props;
  const [typing, setTyping] = useState(false);

  if (mode === 'cover' && props.typedCover != null) {
    return (
      <View style={{ gap: spacing.md }}>
        <TypedCoverTextField key={props.typedCover} initialText={props.typedCover} onSubmit={props.onCoverText} disabled={paused} />
        <Button variant="ghost" label={t('scan.host.backToCover')} onPress={props.onTypedCoverDone} />
      </View>
    );
  }
  const cover = (cameraBlocked?: ReactNode) => (
    <CoverCapture
      recognize={props.recognize}
      available={props.ocrAvailable}
      onRecognised={props.onOcr}
      onTypeText={props.onCoverText}
      choosePhoto={props.choosePhoto}
      cameraBlocked={cameraBlocked}
      paused={paused}
      onDiscardPhoto={props.onDiscardPhoto}
    />
  );
  if (typing || permission.state === 'loading') {
    return (
      <View style={{ gap: spacing.md }}>
        {permission.state === 'loading' ? <Text color="inkMuted">{t('scan.host.cameraLoading')}</Text> : null}
        {mode === 'barcode' ? <TypedIsbnField onSubmit={props.onIsbnText} disabled={paused} /> : <TypedCoverTextField onSubmit={props.onCoverText} disabled={paused} />}
        {typing && permission.state !== 'denied' ? <Button variant="ghost" label={t('scan.host.useCamera')} onPress={() => setTyping(false)} /> : null}
      </View>
    );
  }
  if (permission.state !== 'granted') {
    const prompt = (
      <PermissionPrompt
        state={permission.state}
        typeLabel={mode === 'barcode' ? t('scan.permission.typeIsbn') : t('scan.permission.typeCoverText')}
        onAllow={permission.request}
        onOpenSettings={permission.openSettings}
        onTypeIsbn={() => setTyping(true)}
      />
    );
    // Choosing a photo of the cover needs no camera permission.
    return mode === 'cover' && props.ocrAvailable && props.choosePhoto ? cover(prompt) : prompt;
  }
  return (
    <View style={{ gap: spacing.md }}>
      {mode === 'barcode' ? (
        <BarcodeScanner onBarcode={props.onBarcode} paused={paused} onReadCover={() => props.onModeChange('cover')} />
      ) : (
        cover()
      )}
      {mode === 'barcode' ? <Button variant="ghost" label={t('scan.host.typeIsbn')} onPress={() => setTyping(true)} /> : null}
    </View>
  );
}
