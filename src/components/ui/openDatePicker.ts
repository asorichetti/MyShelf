import type { IsoDate } from '@/domain';

export interface DatePickerRequest {
  value: IsoDate;
  min?: IsoDate;
  max?: IsoDate;
}

/**
 * Opens the platform's calendar picker. Android has one (see
 * `openDatePicker.android.ts`); elsewhere there is none, so the date field
 * offers typing only and hides its calendar button.
 */
export const hasDatePicker = false;

export async function openDatePicker(_request: DatePickerRequest): Promise<IsoDate | null> {
  return null;
}
