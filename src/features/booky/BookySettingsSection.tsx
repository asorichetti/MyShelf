import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Booky, useBooky } from '@/components/booky';
import { SettingsSection } from '@/components/settings/SettingsRow';
import { Button, Chip, Text, useSnackbar } from '@/components/ui';
import type { BookyMode } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

const modes: { mode: BookyMode; label: string; hint: string; testID: string }[] = [
  { mode: 'helpful', label: 'Helpful', hint: 'All my tips, when they’re useful.', testID: Testids.bookySettings.modeHelpful },
  { mode: 'quiet', label: 'Quiet', hint: 'Only problems, empty screens and help when you ask.', testID: Testids.bookySettings.modeQuiet },
  { mode: 'off', label: 'Off', hint: 'I stay out of sight. The help buttons still work.', testID: Testids.bookySettings.modeOff },
];

/**
 * Settings → Booky (P07-06): how chatty Booky is (Helpful, Quiet, Off; saved
 * as the `bookyMode` setting), "Reset tips" (forgets what was shown and
 * muted: `booky.seen`, `mutedTips`) and "Show the welcome tour" (the
 * onboarding again). Self-contained: drop it into the Settings screen.
 */
export function BookySettingsSection() {
  const { spacing } = useTheme();
  const { mode, setMode, resetTips } = useBooky();
  const { show } = useSnackbar();
  const current = modes.find((m) => m.mode === mode) ?? modes[0];
  return (
    <View testID={Testids.bookySettings.root}>
      <SettingsSection title="Booky" intro="How chatty your library helper is. Help buttons always work.">
        <View style={{ gap: spacing.sm, padding: spacing.sm }}>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Booky expression={mode === 'quiet' ? 'sleepy' : 'happy'} size={36} animated={false} />
            <View role="radiogroup" aria-label="How chatty Booky is" style={[styles.row, styles.wrap, styles.fill, { gap: spacing.sm }]}>
              {modes.map((m) => (
                <Chip key={m.mode} label={m.label} role="radio" selected={m.mode === mode} onPress={() => setMode(m.mode)} testID={m.testID} accessibilityLabel={`${m.label}: ${m.hint}`} />
              ))}
            </View>
          </View>
          <Text color="inkMuted" role="status" aria-live="polite" accessibilityLiveRegion="polite">
            {current.hint}
          </Text>
          <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
            <Button
              variant="secondary"
              label="Reset tips"
              accessibilityHint="Shows tips you have seen or muted again"
              onPress={() => {
                resetTips();
                show({ message: 'Done: I’ll show my tips again when they’re useful.' });
              }}
              testID={Testids.bookySettings.resetTips}
            />
            <Button variant="ghost" label="Show the welcome tour" onPress={() => router.navigate('/onboarding')} testID={Testids.bookySettings.tour} />
          </View>
        </View>
      </SettingsSection>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  fill: { flex: 1 },
});
