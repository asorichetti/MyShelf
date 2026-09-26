import { router } from 'expo-router';

/** Closes every screen above the tabs and shows the Shelf (after a restore, an import or an erase). */
export function goToShelf(): void {
  router.dismissTo('/');
}
