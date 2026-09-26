import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import type { OcrResult } from '@/domain';
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
}

/**
 * The phone's scanner (P03-02, P03-03, P03-05): the camera only once it is
 * allowed; a barcode reader or a cover camera by mode; typing the ISBN is
 * always one tap away. The web build has its own (ScannerHost.web.tsx).
 */
export function ScannerHost(props: ScannerHostProps) {
  const { spacing } = useTheme();
  const { permission, mode, paused } = props;
  const [typing, setTyping] = useState(false);

  if (typing || permission.state === 'loading') {
    return (
      <View style={{ gap: spacing.md }}>
        {permission.state === 'loading' ? <Text color="inkMuted">Getting the camera ready…</Text> : null}
        {mode === 'barcode' ? <TypedIsbnField onSubmit={props.onIsbnText} disabled={paused} /> : <TypedCoverTextField onSubmit={props.onCoverText} disabled={paused} />}
        {typing && permission.state !== 'denied' ? <Button variant="ghost" label="Use the camera instead" onPress={() => setTyping(false)} /> : null}
      </View>
    );
  }
  if (permission.state !== 'granted') {
    return (
      <PermissionPrompt
        state={permission.state}
        typeLabel={mode === 'barcode' ? 'Type ISBN instead' : 'Type the cover text instead'}
        onAllow={permission.request}
        onOpenSettings={permission.openSettings}
        onTypeIsbn={() => setTyping(true)}
      />
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      {mode === 'barcode' ? (
        <BarcodeScanner onBarcode={props.onBarcode} paused={paused} onReadCover={() => props.onModeChange('cover')} />
      ) : (
        <CoverCapture recognize={props.recognize} available={props.ocrAvailable} onRecognised={props.onOcr} onTypeText={props.onCoverText} paused={paused} />
      )}
      {mode === 'barcode' ? <Button variant="ghost" label="Type the ISBN instead" onPress={() => setTyping(true)} /> : null}
    </View>
  );
}
