import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { Button, Text } from '@/components/ui';
import { formatSeriesLabel, formatSeriesPosition } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { SeriesInput, type SeriesOption } from './SeriesInput';

export interface SeriesConfirmProps {
  seriesName: string;
  position: number | null;
  existing: readonly SeriesOption[];
  busy?: boolean;
  onYes: () => void;
  onNo: () => void;
  /** Saves a different series or number; resolves to an error for the form, or null when saved. */
  onChange: (name: string, position: string) => Promise<{ field: 'name' | 'position'; message: string } | null>;
}

/**
 * "Is this Discworld #5?" (P04-03): shown on a book's page when its series
 * came from a guess. Yes keeps it; Change opens the series picker in place;
 * Not a series removes it for good.
 */
export function SeriesConfirm({ seriesName, position, existing, busy = false, onYes, onNo, onChange }: SeriesConfirmProps) {
  const { colors, spacing, radii } = useTheme();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(seriesName);
  const [pos, setPos] = useState(formatSeriesPosition(position));
  const [error, setError] = useState<{ field: 'name' | 'position'; message: string } | null>(null);
  const label = formatSeriesLabel(seriesName, position);

  const save = async () => {
    setError(await onChange(name, pos));
  };

  return (
    <View
      role="group"
      aria-label={t('bookDetail.seriesConfirm.label')}
      testID={Testids.seriesConfirm.root}
      style={[styles.card, { gap: spacing.md, padding: spacing.md, borderRadius: radii.md, borderColor: colors.primary, backgroundColor: colors.surfaceTint }]}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <Booky expression="thinking" size={44} animated={false} />
        <View style={[styles.flex, { gap: spacing.xxs }]}>
          <Text variant="bodyStrong">{t('bookDetail.seriesConfirm.question', { series: label })}</Text>
          <Text variant="caption" color="inkMuted">
            {t('bookDetail.seriesConfirm.explanation')}
          </Text>
        </View>
      </View>
      {editing ? (
        <View style={{ gap: spacing.sm }}>
          <SeriesInput
            name={name}
            position={pos}
            onNameChange={(v) => {
              setName(v);
              setError(null);
            }}
            onPositionChange={(v) => {
              setPos(v);
              setError(null);
            }}
            existing={existing}
            nameError={error?.field === 'name' ? error.message : undefined}
            positionError={error?.field === 'position' ? error.message : undefined}
          />
          <View style={[styles.actions, { gap: spacing.sm }]}>
            <Button variant="ghost" label={t('common.cancel')} onPress={() => setEditing(false)} disabled={busy} testID={Testids.seriesConfirm.cancel} />
            <Button label={t('bookDetail.seriesConfirm.save')} onPress={save} loading={busy} testID={Testids.seriesConfirm.save} />
          </View>
        </View>
      ) : (
        <View style={[styles.actions, { gap: spacing.sm }]}>
          <Button label={t('bookDetail.seriesConfirm.yes')} accessibilityLabel={t('bookDetail.seriesConfirm.yesLabel', { series: label })} onPress={onYes} disabled={busy} testID={Testids.seriesConfirm.yes} />
          <Button variant="secondary" label={t('bookDetail.seriesConfirm.change')} onPress={() => setEditing(true)} disabled={busy} testID={Testids.seriesConfirm.change} />
          <Button variant="ghost" label={t('bookDetail.seriesConfirm.no')} onPress={onNo} disabled={busy} testID={Testids.seriesConfirm.no} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
});
