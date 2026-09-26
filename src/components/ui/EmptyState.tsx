import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Button, type ButtonVariant } from './Button';
import { Heading, type HeadingLevel } from './Heading';
import { Text } from './Text';

import type { ReactNode } from 'react';

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  testID?: string;
  variant?: ButtonVariant;
}

export interface EmptyStateProps {
  title: string;
  message?: string;
  /** Illustration shown above the title (e.g. Booky). */
  illustration?: ReactNode;
  /** Heading level of the title. Use 1 only when it is the screen's main heading. */
  headingLevel?: HeadingLevel;
  titleTestID?: string;
  action?: EmptyStateAction;
  testID?: string;
}

export function EmptyState({ title, message, illustration, headingLevel = 2, titleTestID, action, testID }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View testID={testID} style={[styles.root, { gap: theme.spacing.md, padding: theme.spacing.xl }]}>
      {illustration ? <View style={{ marginBottom: theme.spacing.sm }}>{illustration}</View> : null}
      <Heading level={headingLevel} align="center" testID={titleTestID}>
        {title}
      </Heading>
      {message ? (
        <Text color="inkMuted" align="center" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          testID={action.testID}
          variant={action.variant ?? 'primary'}
          style={{ marginTop: theme.spacing.sm, alignSelf: 'center' }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  message: { maxWidth: 360 },
});
