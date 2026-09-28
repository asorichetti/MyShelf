import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Keyboard } from 'react-native';

import { parseIsoDate, toIsoDate, type IsoDate } from '@/domain';

import type { DatePickerRequest } from './openDatePicker';

export type { DatePickerRequest } from './openDatePicker';

/** Android's Material calendar dialog, which TalkBack reads and navigates. */
export const hasDatePicker = true;

/** Resolves with the chosen local calendar date, or null when dismissed. */
export function openDatePicker({ value, min, max }: DatePickerRequest): Promise<IsoDate | null> {
  // Put the keyboard away first: Android gives focus back to the focused field
  // when the dialog closes, which would bring the keyboard up over the sheet.
  Keyboard.dismiss();
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
