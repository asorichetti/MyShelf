import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { MAX_RATING, ratingForKey, ratingValues, ratingValueText, stepRating, tapRating, type Rating } from '@/domain';
import { t, translate, type MessageKey } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { focusView } from './focusView';
import { IconButton } from './IconButton';

export interface StarRatingProps {
  /** 1-5 stars, or null for not rated. */
  value: number | null;
  /** Called with the new rating (null when cleared). */
  onChange: (rating: Rating | null) => void;
  /** The control's name, read before its value: "Rating: 4 out of 5 stars". */
  label?: string;
  /** Shows the "Clear rating" button beside the stars (default true). */
  clearable?: boolean;
  disabled?: boolean;
  testID?: string;
}

const STAR_ICON = 30;
const ACTIONS: readonly { name: string; label: MessageKey }[] = [
  { name: 'increment', label: 'rating.control.more' },
  { name: 'decrement', label: 'rating.control.fewer' },
];

/**
 * The reader's rating as five stars (P10-02). One adjustable control, as a
 * screen reader meets it: "Rating, 4 out of 5 stars, slider" (TalkBack:
 * swipe up or down for a star more or fewer); on the web the arrow keys,
 * Home (not rated) and End (5 stars), a digit, and Delete to clear. Each
 * star is a 48 dp target for a finger or a pointer; tapping the current
 * rating clears it, and "Clear rating" says so in words. No animation.
 */
export function StarRating({ value, onChange, label: labelProp, clearable = true, disabled = false, testID = Testids.rating.control }: StarRatingProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const label = labelProp ?? t('rating.control.label');
  const [focused, setFocused] = useState(false);
  const slider = useRef<View>(null);
  const current = value != null && value >= 1 && value <= MAX_RATING ? value : null;
  const valueText = ratingValueText(current);

  const set = (next: Rating | null) => {
    if (!disabled && next !== current) onChange(next);
  };
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') set(stepRating(current, 1));
    else if (e.nativeEvent.actionName === 'decrement') set(stepRating(current, -1));
  };
  const onKeyDown = (e: { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; preventDefault: () => void }) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const next = ratingForKey(current, e.key);
    if (next === undefined) return;
    e.preventDefault();
    set(next);
  };

  return (
    <View style={[styles.row, { columnGap: spacing.xs }]}>
      <View
        ref={slider}
        role="slider"
        accessible
        focusable={!disabled}
        accessibilityLabel={label}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={MAX_RATING}
        aria-valuenow={current ?? 0}
        aria-valuetext={valueText}
        accessibilityValue={{ min: 0, max: MAX_RATING, now: current ?? 0, text: valueText }}
        accessibilityActions={ACTIONS.map((a) => ({ name: a.name, label: translate(a.label) }))}
        onAccessibilityAction={onAccessibilityAction}
        aria-disabled={disabled}
        accessibilityState={{ disabled }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Web only: react-native-web passes key events through; a phone uses the accessibility actions above.
        {...({ onKeyDown } as object)}
        testID={testID}
        style={[
          styles.stars,
          {
            borderRadius: radii.md,
            borderWidth: 2,
            borderColor: focused ? colors.primary : 'transparent',
          },
          disabled && styles.disabled,
        ]}
      >
        {/* The stars are only for fingers and pointers: a screen reader and the keyboard use the slider itself. */}
        <View aria-hidden importantForAccessibility="no-hide-descendants" style={styles.stars}>
          {ratingValues.map((n) => {
            const filled = current != null && n <= current;
            return (
              <Pressable
                key={n}
                tabIndex={-1}
                disabled={disabled}
                onPress={() => {
                  set(tapRating(current, n));
                  // A click would leave focus on the (hidden) star: give it to the slider, where the keys work.
                  focusView(slider.current);
                }}
                testID={Testids.rating.star}
                style={({ pressed }) => [
                  styles.star,
                  { width: sizes.touchTarget, height: sizes.touchTarget, borderRadius: radii.pill, backgroundColor: pressed ? colors.surfaceTint : 'transparent' },
                ]}
              >
                <MaterialCommunityIcons name={filled ? 'star' : 'star-outline'} size={STAR_ICON} color={filled ? colors.primary : colors.outline} />
              </Pressable>
            );
          })}
        </View>
      </View>
      {clearable ? (
        <IconButton
          icon="close-circle-outline"
          accessibilityLabel={t('rating.control.clear')}
          disabled={disabled || current == null}
          onPress={() => {
            set(null);
            // The button is disabled once there is nothing to clear: keep the keyboard on the stars.
            focusView(slider.current);
          }}
          testID={Testids.rating.clear}
        />
      ) : null}
    </View>
  );
}

export interface StarRatingDisplayProps {
  /** 1-5 stars; nothing is drawn for null. */
  value: number | null | undefined;
  /** Drawn size of each star. */
  size?: number;
  testID?: string;
}

/**
 * A read-only rating for rows, covers and cards: small stars, filled up to
 * the rating. Decorative, because the row it sits in already says "rated 4
 * out of 5" in its name; nothing at all when not rated.
 */
export function StarRatingDisplay({ value, size = 14, testID = Testids.rating.display }: StarRatingDisplayProps) {
  const { colors } = useTheme();
  if (value == null || value < 1) return null;
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={testID} style={styles.stars}>
      {ratingValues.map((n) => (
        <MaterialCommunityIcons key={n} name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? colors.primary : colors.outline} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  stars: { flexDirection: 'row', alignItems: 'center' },
  star: { alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
