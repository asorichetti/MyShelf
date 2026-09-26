import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { focusView } from '@/components/ui/focusView';
import { useTheme, type ColorRole } from '@/theme';

import type { ReactNode } from 'react';

export type NoticeTone = 'info' | 'success' | 'warn' | 'danger';

const toneColors: Record<NoticeTone, { bg: ColorRole; fg: ColorRole; icon: 'information-outline' | 'check-circle-outline' | 'alert-outline' | 'alert-circle-outline' }> = {
  info: { bg: 'primaryContainer', fg: 'onPrimaryContainer', icon: 'information-outline' },
  success: { bg: 'successContainer', fg: 'onSuccessContainer', icon: 'check-circle-outline' },
  warn: { bg: 'warnContainer', fg: 'onWarnContainer', icon: 'alert-outline' },
  danger: { bg: 'dangerContainer', fg: 'onDangerContainer', icon: 'alert-circle-outline' },
};

export interface SettingsNoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  testID?: string;
  /** `alert` for errors (read out at once), `status` for results (read out politely). Default: by tone. */
  role?: 'alert' | 'status' | 'none';
  /** Buttons under the text. */
  actions?: ReactNode;
  /**
   * Take focus when shown: for a result that replaces the button that asked
   * for it (an import's report, a finished restore), so focus is not lost
   * and a screen reader reads the result out.
   */
  focusOnShow?: boolean;
}

/** A soft coloured box for a result, a warning or an error, with an icon so colour is never the only signal. */
export function SettingsNotice({ tone = 'info', title, children, testID, role, actions, focusOnShow = false }: SettingsNoticeProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  const box = useRef<View>(null);
  useEffect(() => {
    if (focusOnShow) focusView(box.current);
  }, [focusOnShow]);
  const c = toneColors[tone];
  const liveRole = role ?? (tone === 'danger' ? 'alert' : 'status');
  return (
    <View
      ref={box}
      testID={testID}
      {...(focusOnShow ? { tabIndex: -1 as const } : {})}
      role={liveRole === 'none' ? undefined : liveRole}
      aria-live={liveRole === 'alert' ? 'assertive' : liveRole === 'status' ? 'polite' : undefined}
      accessibilityLiveRegion={liveRole === 'alert' ? 'assertive' : liveRole === 'status' ? 'polite' : undefined}
      style={[styles.box, { backgroundColor: colors[c.bg], borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }]}
    >
      <View style={[styles.row, { gap: spacing.sm }]}>
        <MaterialCommunityIcons name={c.icon} size={sizes.icon} color={colors[c.fg]} />
        <View style={[styles.flex, { gap: 2 }]}>
          {title ? (
            <Text variant="bodyStrong" color={c.fg}>
              {title}
            </Text>
          ) : null}
          {typeof children === 'string' ? <Text color={c.fg}>{children}</Text> : children}
        </View>
      </View>
      {actions ? <View style={[styles.actions, { gap: spacing.sm }]}>{actions}</View> : null}
    </View>
  );
}

export interface ChoiceOption<V extends string> {
  value: V;
  label: string;
  description: string;
  testID?: string;
}

export interface ChoiceGroupProps<V extends string> {
  label: string;
  value: V | null;
  options: readonly ChoiceOption<V>[];
  onChange: (value: V) => void;
  testID?: string;
}

/** Big radio cards (a label and a sentence each), for choices that deserve explaining. */
export function ChoiceGroup<V extends string>({ label, value, options, onChange, testID }: ChoiceGroupProps<V>) {
  const { colors, spacing, radii, sizes } = useTheme();
  return (
    <View role="radiogroup" aria-label={label} testID={testID} style={{ gap: spacing.sm }}>
      <Text variant="label">{label}</Text>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            role="radio"
            aria-checked={selected}
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${o.label}. ${o.description}`}
            onPress={() => onChange(o.value)}
            testID={o.testID}
            style={({ pressed }) => [
              styles.row,
              {
                minHeight: sizes.touchTarget,
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radii.md,
                borderWidth: selected ? 2 : 1.5,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: pressed || selected ? colors.surfaceTint : colors.surface,
              },
            ]}
          >
            <MaterialCommunityIcons name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={sizes.icon} color={selected ? colors.primary : colors.outline} />
            <View style={[styles.flex, { gap: 2 }]}>
              <Text variant="bodyStrong">{o.label}</Text>
              <Text variant="caption" color="inkMuted">
                {o.description}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface CheckboxRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testID?: string;
}

/** A whole-row checkbox with an explanation. */
export function CheckboxRow({ label, description, checked, onChange, testID }: CheckboxRowProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  return (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={() => onChange(!checked)}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        { minHeight: sizes.touchTarget, gap: spacing.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radii.md },
        pressed && { backgroundColor: colors.surfaceTint },
      ]}
    >
      <MaterialCommunityIcons name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={sizes.icon} color={checked ? colors.primary : colors.outline} />
      <View style={[styles.flex, { gap: 2 }]}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" color="inkMuted">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {},
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});

export interface ExternalLinkProps {
  label: string;
  url: string;
  onOpen: (url: string) => void;
  testID?: string;
}

/** A link that leaves the app for the browser, said so in its name and shown with an "open" icon. */
export function ExternalLink({ label, url, onOpen, testID }: ExternalLinkProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  return (
    <Pressable
      role="link"
      accessibilityLabel={`${label} (opens in your browser)`}
      accessibilityHint={url}
      onPress={() => onOpen(url)}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        { minHeight: sizes.touchTarget, gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.md, alignSelf: 'flex-start' },
        pressed && { backgroundColor: colors.surfaceTint },
      ]}
    >
      <Text variant="bodyStrong" color="primary" style={{ textDecorationLine: 'underline' }}>
        {label}
      </Text>
      <MaterialCommunityIcons name="open-in-new" size={sizes.icon - 4} color={colors.primary} />
    </Pressable>
  );
}
