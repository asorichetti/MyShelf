import { StyleSheet, View } from 'react-native';

import { Button, Heading, Sheet, Text } from '@/components/ui';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { Booky } from './Booky';
import { useBookyMode } from './BookyProvider';
import { helpContent } from './helpContent';
import { lastHelpButton } from './helpFocus';

import type { HelpScreen } from './tips';

/** The help sheet (P07-05): short sections for one screen. Booky sits in the corner unless Booky is off. */
export function HelpSheet({ screen, onClose }: { screen: string | null; onClose: () => void }) {
  const { spacing } = useTheme();
  const mode = useBookyMode();
  const content = screen && screen in helpContent ? helpContent[screen as HelpScreen] : null;
  return (
    <Sheet
      visible={content != null}
      title={content?.title ?? t('booky.helpSheet.title')}
      subtitle={t('booky.helpSheet.subtitle')}
      onClose={onClose}
      // Opened from Booky's tip, which has gone by the time the sheet closes: focus goes back to the help button.
      returnFocusTo={lastHelpButton}
      testID={Testids.booky.helpSheet}
      footer={<Button label={t('booky.helpSheet.close')} onPress={onClose} testID={Testids.booky.helpClose} />}
    >
      {mode === 'off' ? null : (
        <View style={styles.booky}>
          <Booky expression="thinking" size={48} animated={false} />
        </View>
      )}
      {content?.sections.map((s) => (
        <View key={s.heading} style={{ gap: spacing.xxs }}>
          <Heading level={3}>{s.heading}</Heading>
          <Text>{s.body}</Text>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  booky: { alignItems: 'flex-end' },
});
