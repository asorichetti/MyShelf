import type { IconName } from '@/components/ui';
import { groupIconOf, type GroupIcon } from '@/domain';


/** The drawn icon for each group icon id. */
export const groupIconNames: Record<GroupIcon, IconName> = {
  heart: 'heart',
  star: 'star',
  bookmark: 'bookmark',
  gift: 'gift',
  moon: 'moon-waning-crescent',
  sun: 'white-balance-sunny',
  pen: 'fountain-pen-tip',
  home: 'home',
};

/** The drawn icon for a stored value (unknown values get the default). */
export const groupIconName = (stored: string | null | undefined): IconName => groupIconNames[groupIconOf(stored)];
