import { View } from 'react-native';

import { Heading, Screen, Text, TopBar } from '@/components/ui';
import { goBackOr } from '@/features/navigation/goBack';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import type { ReactNode } from 'react';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

export interface SettingsPageProps {
  title: string;
  intro?: ReactNode;
  testID: string;
  backTestID?: string;
  pageState?: 'content' | 'error';
  children: ReactNode;
}

/** A screen under Settings: Back (to Settings when opened directly), one h1, a line of explanation, then the content. */
export function SettingsPage({ title, intro, testID, backTestID, pageState = 'content', children }: SettingsPageProps) {
  const { spacing } = useTheme();
  return (
    <Screen testID={testID} edges={[...EDGES]} pageState={pageState}>
      <TopBar onBack={() => goBackOr('/settings')} backLabel={t('settings.page.back')} backTestID={backTestID} />
      <View style={{ gap: spacing.xs }}>
        <Heading level={1}>{title}</Heading>
        {typeof intro === 'string' ? <Text color="inkMuted">{intro}</Text> : intro}
      </View>
      {children}
    </Screen>
  );
}
