import { StyleSheet, View } from 'react-native';

import { Heading, Text } from '@/components/ui';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Booky } from './Booky';

import type { BookyExpression } from './expressions';

export interface OnboardingCardProps {
  expression: BookyExpression;
  title: string;
  text: string;
  /** 1-based. */
  page: number;
  pages: number;
  testID?: string;
  pageTestID?: string;
}

/**
 * One card of the first-run onboarding (P07-03): Booky with a short title
 * (the screen's h1) and two lines, and "Page 2 of 4", which screen readers
 * announce politely as the user moves on. The dots only repeat that
 * visually, so they are hidden from assistive tech.
 */
export function OnboardingCard({ expression, title, text, page, pages, testID, pageTestID }: OnboardingCardProps) {
  const { colors, spacing, radii } = useTheme();
  return (
    <View testID={testID} style={[styles.card, { gap: spacing.lg }]}>
      <Booky expression={expression} size={128} />
      <View style={{ gap: spacing.sm }}>
        <Heading level={1} align="center">
          {title}
        </Heading>
        <Text align="center" color="inkMuted" style={styles.text}>
          {text}
        </Text>
      </View>
      <Text variant="label" color="inkMuted" role="status" aria-live="polite" accessibilityLiveRegion="polite" testID={pageTestID}>
        {t('onboarding.page', { page, pages })}
      </Text>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.dots, { gap: spacing.sm }]}>
        {Array.from({ length: pages }, (_, i) => (
          <View
            key={i}
            style={{ width: i + 1 === page ? spacing.lg : spacing.sm, height: spacing.sm, borderRadius: radii.pill, backgroundColor: i + 1 === page ? colors.primary : colors.cardLine }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center' },
  text: { maxWidth: 360 },
  dots: { flexDirection: 'row', alignItems: 'center' },
});
