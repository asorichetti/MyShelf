import { useState } from 'react';
import { View } from 'react-native';

import { Button, SelectField, Text, TextField } from '@/components/ui';
import { formatDateAs, MAX_LOAN_DAYS, today, type DateFormat, type ShelfGroupBy, type ShelfViewMode } from '@/domain';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { dateFormatOptions, groupByOptions, LOAN_LENGTHS, loanLengthOptions, parseSortValue, sortOptions, sortValue, viewModeOptions } from './preferenceOptions';
import { SettingsPage } from './SettingsPage';
import { useSettings } from './useSettings';

const T = Testids.settings;
const MAX_CUSTOM_DAYS = 365;

/**
 * Settings → Shelf and lending (P08-07): how the Shelf opens (sort, sections,
 * view), the default loan length and how dates are written. Each choice is
 * saved the moment it is made and used by its screen: the Shelf, the lend
 * sheet's due date, every full date in the app.
 */
export function PreferencesScreen() {
  const { spacing } = useTheme();
  const { settings, set } = useSettings();
  const [custom, setCustom] = useState<string | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);

  if (!settings) return <LoadingPage />;

  const isPreset = (LOAN_LENGTHS as readonly number[]).includes(settings.loanDays);
  const loanChoice = custom != null || !isPreset ? 'custom' : String(settings.loanDays);
  const example = formatDateAs(today(), settings.dateFormat);

  const saveCustom = () => {
    const days = Number((custom ?? '').trim());
    if (!Number.isInteger(days) || days < 1 || days > Math.min(MAX_CUSTOM_DAYS, MAX_LOAN_DAYS)) {
      setCustomError(`Enter a number of days from 1 to ${MAX_CUSTOM_DAYS}.`);
      return;
    }
    setCustomError(null);
    setCustom(null);
    void set('loanDays', days);
  };

  return (
    <SettingsPage
      title="Shelf and lending"
      intro="Changes are saved straight away."
      testID={Testids.preferences.root}
      backTestID={Testids.preferences.back}
    >
      <View style={{ gap: spacing.lg }}>
        <SelectField
          label="Sort the shelf by"
          value={sortValue(settings.shelfSort)}
          options={sortOptions}
          allowNone={false}
          onChange={(v) => {
            const sort = parseSortValue(v);
            if (sort) void set('shelfSort', sort);
          }}
          testID={T.sort}
        />
        <SelectField
          label="Split the shelf into sections by"
          value={settings.shelfGroupBy}
          options={groupByOptions}
          allowNone={false}
          onChange={(v) => void set('shelfGroupBy', v as ShelfGroupBy)}
          testID={T.groupBy}
        />
        <SelectField
          label="Show books as"
          value={settings.shelfViewMode}
          options={viewModeOptions}
          allowNone={false}
          onChange={(v) => void set('shelfViewMode', v as ShelfViewMode)}
          testID={T.viewMode}
        />
        <View style={{ gap: spacing.sm }}>
          <SelectField
            label="Lend books for"
            value={loanChoice}
            options={loanChoice === 'custom' && !isPreset && custom == null ? [...loanLengthOptions.slice(0, -1), { value: 'custom', label: `${settings.loanDays} days (custom)` }] : loanLengthOptions}
            allowNone={false}
            helperText="The due date a new loan starts with. You can still change it when lending."
            onChange={(v) => {
              if (v === 'custom') {
                setCustom(String(settings.loanDays));
                return;
              }
              setCustom(null);
              setCustomError(null);
              void set('loanDays', Number(v));
            }}
            testID={T.loanLength}
          />
          {custom != null ? (
            <View style={{ gap: spacing.sm }}>
              <TextField
                label="Days until a loan is due"
                value={custom}
                onChangeText={setCustom}
                keyboardType="number-pad"
                inputMode="numeric"
                errorText={customError ?? undefined}
                onSubmitEditing={saveCustom}
                testID={T.loanLengthCustom}
              />
              <Button label="Use this length" variant="secondary" onPress={saveCustom} />
            </View>
          ) : null}
        </View>
        <View style={{ gap: spacing.xs }}>
          <SelectField
            label="Write dates as"
            value={settings.dateFormat}
            options={dateFormatOptions}
            allowNone={false}
            onChange={(v) => void set('dateFormat', v as DateFormat)}
            testID={T.dateFormat}
          />
          <Text variant="caption" color="inkMuted" testID={T.dateExample}>
            {`Today is written ${example}.`}
          </Text>
        </View>
      </View>
    </SettingsPage>
  );
}
