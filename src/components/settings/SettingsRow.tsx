import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Heading, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import type { ComponentProps, ReactNode } from 'react';

export type SettingsIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface RowBase {
  label: string;
  /** A line under the label: what the row does, or its current value. */
  description?: string | null;
  icon?: SettingsIcon;
  testID?: string;
  disabled?: boolean;
}

export interface SettingsLinkRowProps extends RowBase {
  /** The current value, shown on the right ("28 days"). */
  value?: string | null;
  onPress: () => void;
  /** Destructive rows ("Erase library") are drawn in the danger colour. */
  tone?: 'default' | 'danger';
}

function Icon({ name, tone }: { name: SettingsIcon; tone: 'default' | 'danger' }) {
  const { colors, radii, sizes } = useTheme();
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.icon,
        { width: sizes.icon + 16, height: sizes.icon + 16, borderRadius: radii.pill, backgroundColor: tone === 'danger' ? colors.dangerContainer : colors.primaryContainer },
      ]}
    >
      <MaterialCommunityIcons name={name} size={sizes.icon} color={tone === 'danger' ? colors.onDangerContainer : colors.onPrimaryContainer} />
    </View>
  );
}

/**
 * One tappable row of a settings section that opens another screen: an icon
 * in a soft purple circle, the label with its value or explanation, and a
 * chevron. The whole row is the 48 dp+ target and a link to the screen.
 */
export function SettingsLinkRow({ label, description, value, icon, onPress, testID, disabled = false, tone = 'default' }: SettingsLinkRowProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  const spoken = [label, value, description].filter(Boolean).join(', ');
  return (
    <Pressable
      role="link"
      accessibilityLabel={spoken}
      aria-disabled={disabled}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        { minHeight: sizes.touchTarget + 8, gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md },
        pressed && { backgroundColor: colors.surfaceTint },
        disabled && styles.disabled,
      ]}
    >
      {icon ? <Icon name={icon} tone={tone} /> : null}
      <View style={styles.flex}>
        <Text variant="bodyStrong" color={tone === 'danger' ? 'danger' : 'ink'}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" color="inkMuted">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="label" color="primary" style={styles.value} numberOfLines={2}>
          {value}
        </Text>
      ) : null}
      <MaterialCommunityIcons name="chevron-right" size={sizes.icon} color={colors.inkMuted} />
    </Pressable>
  );
}

export interface SettingsSwitchRowProps extends RowBase {
  value: boolean;
  onChange: (on: boolean) => void;
  /** Why it is off or unavailable; read with the switch. */
  note?: string | null;
  noteTestID?: string;
}

const TRACK_W = 52;
const TRACK_H = 32;
const KNOB = 24;

/** A whole-row switch (label, explanation and state read together), like the loan reminders switch. */
export function SettingsSwitchRow({ label, description, value, onChange, icon, testID, disabled = false, note, noteTestID }: SettingsSwitchRowProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  return (
    <View>
      <Pressable
        role="switch"
        aria-checked={value}
        aria-disabled={disabled}
        accessibilityState={{ checked: value, disabled }}
        accessibilityLabel={label}
        accessibilityHint={description ?? undefined}
        disabled={disabled}
        onPress={() => onChange(!value)}
        testID={testID}
        style={({ pressed }) => [
          styles.row,
          { minHeight: sizes.touchTarget + 8, gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md },
          pressed && { backgroundColor: colors.surfaceTint },
          disabled && styles.disabled,
        ]}
      >
        {icon ? <Icon name={icon} tone="default" /> : null}
        <View style={styles.flex}>
          <Text variant="bodyStrong">{label}</Text>
          {description ? (
            <Text variant="caption" color="inkMuted">
              {description}
            </Text>
          ) : null}
        </View>
        <View
          aria-hidden
          style={[
            styles.track,
            { width: TRACK_W, height: TRACK_H, borderRadius: radii.pill, backgroundColor: value ? colors.primary : colors.surface, borderColor: value ? colors.primary : colors.outline },
          ]}
        >
          <View
            style={{ width: KNOB, height: KNOB, borderRadius: radii.pill, backgroundColor: value ? colors.onPrimary : colors.outline, alignSelf: value ? 'flex-end' : 'flex-start' }}
          />
        </View>
      </Pressable>
      {note ? (
        <Text
          variant="caption"
          color="inkMuted"
          testID={noteTestID}
          role="status"
          aria-live="polite"
          accessibilityLiveRegion="polite"
          style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

export interface SettingsSectionProps {
  title: string;
  /** One line under the heading. */
  intro?: string;
  children: ReactNode;
  testID?: string;
}

/**
 * A group of settings rows under an h2: a warm card with the rows divided by
 * the catalogue card's faint ruled lines.
 */
export function SettingsSection({ title, intro, children, testID }: SettingsSectionProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <View style={{ gap: 2, paddingHorizontal: spacing.xs }}>
        <Heading level={2}>{title}</Heading>
        {intro ? (
          <Text variant="caption" color="inkMuted">
            {intro}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.xs, boxShadow: theme.elevation.low },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** A faint ruled line between rows of a section. */
export function SettingsDivider() {
  const { colors, spacing } = useTheme();
  return <View aria-hidden style={{ height: 1, backgroundColor: colors.cardLine, marginHorizontal: spacing.md }} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  value: { maxWidth: '40%', textAlign: 'right' },
  icon: { alignItems: 'center', justifyContent: 'center' },
  track: { borderWidth: 2, justifyContent: 'center', paddingHorizontal: 2 },
  card: { borderWidth: 1 },
  disabled: { opacity: 0.6 },
});
