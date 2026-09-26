import { emit } from '@/features/events';

/** After a restore, an import or an erase: every screen showing anything reloads. */
export function announceLibraryReplaced(): void {
  emit('library-changed');
  emit('loans-changed');
  emit('groups-changed');
  emit('settings-changed');
  emit('pending-changed');
}
