import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

/** Summaries longer than this start collapsed to five lines. */
export const SUMMARY_COLLAPSE_CHARS = 280;
export const SUMMARY_COLLAPSED_LINES = 5;

export interface SummaryTextProps {
  text: string;
  testID?: string;
  readMoreTestID?: string;
}

/** A book summary, collapsed to five lines with "Read more" when it is long. */
export function SummaryText({ text, testID, readMoreTestID }: SummaryTextProps) {
  const { spacing } = useTheme();
  const long = text.length > SUMMARY_COLLAPSE_CHARS;
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text testID={testID} numberOfLines={long && !expanded ? SUMMARY_COLLAPSED_LINES : undefined}>
        {text}
      </Text>
      {long ? (
        <Button
          variant="ghost"
          label={expanded ? t('bookDetail.summary.showLess') : t('bookDetail.summary.readMore')}
          accessibilityLabel={expanded ? t('bookDetail.summary.showLessLabel') : t('bookDetail.summary.readMoreLabel')}
          expanded={expanded}
          onPress={() => setExpanded((e) => !e)}
          testID={readMoreTestID}
          style={{ paddingHorizontal: spacing.sm }}
        />
      ) : null}
    </View>
  );
}
