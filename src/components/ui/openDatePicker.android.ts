import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { parseIsoDate, toIsoDate, type IsoDate } from '@/domain';

import type { DatePickerRequest } from './openDatePicker';

export type { DatePickerRequest } from './openDatePicker';

/** Android's Material calendar dialog, which TalkBack reads and navigates. */
export const hasDatePicker = true;

/** Resolves with the chosen local calendar date, or null when dismissed. */
export function openDatePicker({ value, min, max }: DatePickerRequest): Promise<IsoDate | null> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      mode: 'date',
      value: parseIsoDate(value),
      minimumDate: min ? parseIsoDate(min) : undefined,
      maximumDate: max ? parseIsoDate(max) : undefined,
      onValueChange: (_event, date) => resolve(toIsoDate(date)),
      onDismiss: () => resolve(null),
    });
  });
}
