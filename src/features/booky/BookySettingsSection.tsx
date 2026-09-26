import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Booky, useBooky } from '@/components/booky';
import { SettingsSection } from '@/components/settings/SettingsRow';
import { Button, Chip, Text, useSnackbar } from '@/components/ui';
import type { BookyMode } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

const modes: { mode: BookyMode; testID: string }[] = [
  { mode: 'helpful', testID: Testids.bookySettings.modeHelpful },
  { mode: 'quiet', testID: Testids.bookySettings.modeQuiet },
  { mode: 'off', testID: Testids.bookySettings.modeOff },
];

const modeLabel = (mode: BookyMode) => t(`booky.settings.modes.${mode}.label`);
const modeHint = (mode: BookyMode) => t(`booky.settings.modes.${mode}.hint`);

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
      <SettingsSection title={t('booky.settings.title')} intro={t('booky.settings.intro')}>
        <View style={{ gap: spacing.sm, padding: spacing.sm }}>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Booky expression={mode === 'quiet' ? 'sleepy' : 'happy'} size={36} animated={false} />
            <View role="radiogroup" aria-label={t('booky.settings.modesLabel')} style={[styles.row, styles.wrap, styles.fill, { gap: spacing.sm }]}>
              {modes.map((m) => (
                <Chip
                  key={m.mode}
                  label={modeLabel(m.mode)}
                  role="radio"
                  selected={m.mode === mode}
                  onPress={() => setMode(m.mode)}
                  testID={m.testID}
                  accessibilityLabel={t('booky.settings.modeChip', { label: modeLabel(m.mode), hint: modeHint(m.mode) })}
                />
              ))}
            </View>
          </View>
          <Text color="inkMuted" role="status" aria-live="polite" accessibilityLiveRegion="polite">
            {modeHint(current.mode)}
          </Text>
          <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
            <Button
              variant="secondary"
              label={t('booky.settings.resetTips')}
              accessibilityHint={t('booky.settings.resetTipsHint')}
              onPress={() => {
                resetTips();
                show({ message: t('booky.settings.resetDone') });
              }}
              testID={Testids.bookySettings.resetTips}
            />
            <Button variant="ghost" label={t('booky.settings.tour')} onPress={() => router.navigate('/onboarding')} testID={Testids.bookySettings.tour} />
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
