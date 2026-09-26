import { formatDate, toIsoDate } from '@/domain';

/** "12 Oct 2026" for an ISO timestamp, in the chosen date format; "Never" without one. */
export function lastBackupLabel(lastAt: string | null): string {
  if (!lastAt) return 'Never';
  const d = new Date(lastAt);
  return Number.isNaN(d.getTime()) ? 'Never' : formatDate(toIsoDate(d));
}
