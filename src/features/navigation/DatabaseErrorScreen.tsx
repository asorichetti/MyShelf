import { View } from 'react-native';

import { Booky } from '@/components/booky';
import { SettingsNotice } from '@/components/settings/SettingsControls';
import { Button, EmptyState, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useDatabaseFileExport } from './useDatabaseFileExport';

const T = Testids.dbError;

/**
 * "I couldn't open your library": shown when the database will not open or
 * migrate. Try again is the way forward; when it keeps failing, "Save a copy
 * of the library file" hands the raw database file to the share sheet (a
 * download on the web), so the books are never trapped in a broken app.
 */
export function DatabaseErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { spacing } = useTheme();
  const { status, save } = useDatabaseFileExport();
  return (
    <Screen pageState="error" testID={T.root} centered edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState
        testID={Testids.emptyState.root}
        illustration={<Booky expression="concerned" size={120} />}
        headingLevel={1}
        title={t('navigation.databaseError.title')}
        titleTestID={T.title}
        message={t('navigation.databaseError.message')}
        action={{ label: t('common.tryAgain'), onPress: onRetry, testID: T.retry }}
      />
      <Text variant="caption" color="inkMuted" align="center" selectable>
        {error.message}
      </Text>
      <View style={{ gap: spacing.sm }}>
        <Text color="inkMuted" align="center">
          {t('navigation.databaseError.exportHint')}
        </Text>
        <Button label={t('navigation.databaseError.export')} variant="secondary" onPress={() => void save()} loading={status.kind === 'busy'} block testID={T.export} />
        {status.kind === 'done' ? (
          <SettingsNotice tone="success" testID={T.exportStatus}>
            {status.how === 'downloaded' ? t('navigation.databaseError.downloaded', { fileName: status.fileName }) : t('navigation.databaseError.shared', { fileName: status.fileName })}
          </SettingsNotice>
        ) : null}
        {status.kind === 'error' ? (
          <SettingsNotice tone="danger" testID={T.exportStatus}>
            {status.message}
          </SettingsNotice>
        ) : null}
      </View>
    </Screen>
  );
}
