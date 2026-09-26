import { formatDate, toIsoDate } from '@/domain';
import { t } from '@/i18n';

/** "12 Oct 2026" for an ISO timestamp, in the chosen date format; "Never" without one. */
export function lastBackupLabel(lastAt: string | null): string {
  if (!lastAt) return t('backup.never');
  const d = new Date(lastAt);
  return Number.isNaN(d.getTime()) ? t('backup.never') : formatDate(toIsoDate(d));
}
