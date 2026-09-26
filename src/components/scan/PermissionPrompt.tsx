import { View } from 'react-native';

import { Booky } from '@/components/booky';
import { Button, Heading, Text } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface PermissionPromptProps {
  state: 'undetermined' | 'denied';
  onAllow: () => void;
  onOpenSettings: () => void;
  onTypeIsbn: () => void;
  /** The typed alternative's label: "Type ISBN instead" or, in cover mode, "Type the cover text instead". */
  typeLabel?: string;
}

/**
 * Asking for the camera (P03-02): Booky explains what it is for before the
 * system prompt; after a "don't allow" it points at the phone's settings.
 * Typing the ISBN always works instead.
 */
export function PermissionPrompt({ state, onAllow, onOpenSettings, onTypeIsbn, typeLabel = 'Type ISBN instead' }: PermissionPromptProps) {
  const { spacing } = useTheme();
  const denied = state === 'denied';
  return (
    <View testID={Testids.scan.permissionPrompt} style={{ gap: spacing.md, alignItems: 'center' }}>
      <Booky expression={denied ? 'concerned' : 'happy'} size={96} />
      <Heading level={2} align="center">
        {denied ? 'The camera is switched off for MyShelf' : 'May I use the camera?'}
      </Heading>
      <Text align="center" color="inkMuted" testID={denied ? Testids.scan.permissionDenied : undefined}>
        {denied
          ? 'You can switch it back on in your phone’s settings, under MyShelf → Permissions. Or type it in instead.'
          : 'I use the camera only to read barcodes and covers — nothing leaves your phone.'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
        {denied ? (
          <Button label="Open settings" onPress={onOpenSettings} testID={Testids.scan.openSettings} />
        ) : (
          <Button label="Allow camera" onPress={onAllow} testID={Testids.scan.permissionAllow} />
        )}
        <Button variant="secondary" label={typeLabel} onPress={onTypeIsbn} testID={Testids.scan.typeIsbnInstead} />
      </View>
    </View>
  );
}
