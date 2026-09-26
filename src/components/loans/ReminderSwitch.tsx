import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface ReminderSwitchProps {
  value: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  /** Why it is off or unavailable (permission refused, web). */
  note?: string | null;
}

const TRACK_W = 52;
const TRACK_H = 32;
const KNOB = 24;

/**
 * "Remind me when loans are due": a whole-row switch (48 dp and up) with its
 * explanation, so the label, the state and the reason it is off are read
 * together.
 */
export function ReminderSwitch({ value, onChange, disabled = false, note }: ReminderSwitchProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        role="switch"
        aria-checked={value}
        aria-disabled={disabled}
        accessibilityState={{ checked: value, disabled }}
        accessibilityLabel={t('reminders.switch.label')}
        accessibilityHint={t('reminders.switch.hint')}
        disabled={disabled}
        onPress={() => onChange(!value)}
        testID={Testids.reminders.toggle}
        style={({ pressed }) => [
          styles.row,
          { minHeight: sizes.touchTarget, gap: spacing.md, padding: spacing.sm, borderRadius: radii.md },
          pressed && { backgroundColor: colors.surfaceTint },
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('reminders.switch.label')}</Text>
          <Text variant="caption" color="inkMuted">
            {t('reminders.switch.caption')}
          </Text>
        </View>
        <View
          aria-hidden
          style={[
            styles.track,
            { width: TRACK_W, height: TRACK_H, borderRadius: radii.pill, backgroundColor: value ? colors.primary : colors.surface, borderColor: value ? colors.primary : colors.outline },
          ]}
        >
          <View
            style={{
              width: KNOB,
              height: KNOB,
              borderRadius: radii.pill,
              backgroundColor: value ? colors.onPrimary : colors.outline,
              alignSelf: value ? 'flex-end' : 'flex-start',
            }}
          />
        </View>
      </Pressable>
      {note ? (
        <Text variant="caption" color="inkMuted" testID={Testids.reminders.note} role="status" aria-live="polite" accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  track: { borderWidth: 2, justifyContent: 'center', paddingHorizontal: 2 },
  disabled: { opacity: 0.6 },
});
