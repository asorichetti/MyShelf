
import { Stamp } from '@/components/ui';
import { loanStamp, type IsoDate, type Loan } from '@/domain';
import { t } from '@/i18n';

import type { StyleProp, ViewStyle } from 'react-native';

export interface LoanStampProps {
  loan: Pick<Loan, 'dueOn' | 'returnedOn'>;
  today: IsoDate;
  /** Prefix, e.g. "On loan · Sam" on book detail. */
  prefix?: string;
  rotate?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** A loan's rubber stamp: DUE 12 OCT, OVERDUE · 3 DAYS, RETURNED 12 OCT; read out in full. */
export function LoanStamp({ loan, today, prefix, rotate, testID, style }: LoanStampProps) {
  const info = loanStamp(loan, today);
  return (
    <Stamp
      label={prefix ? t('loans.stamp.withPrefix', { prefix, label: info.label }) : info.label}
      tone={info.tone}
      rotate={rotate}
      accessibilityLabel={prefix ? t('loans.stamp.withPrefixDescription', { prefix, description: info.description }) : info.description}
      testID={testID}
      style={style}
    />
  );
}
