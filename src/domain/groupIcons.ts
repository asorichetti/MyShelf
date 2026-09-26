/** The icons a user group can wear. Stored by id in `groups.icon`. */
export const groupIcons = ['heart', 'star', 'bookmark', 'gift', 'moon', 'sun', 'pen', 'home'] as const;
export type GroupIcon = (typeof groupIcons)[number];

export const groupIconLabels: Record<GroupIcon, string> = {
  heart: 'Heart',
  star: 'Star',
  bookmark: 'Bookmark',
  gift: 'Gift',
  moon: 'Moon',
  sun: 'Sun',
  pen: 'Pen',
  home: 'Home',
};

export const DEFAULT_GROUP_ICON: GroupIcon = 'bookmark';

export function isGroupIcon(value: unknown): value is GroupIcon {
  return (groupIcons as readonly unknown[]).includes(value);
}

/** The stored icon if it is one of the set, else the default (older or imported data). */
export function groupIconOf(value: string | null | undefined): GroupIcon {
  return isGroupIcon(value) ? value : DEFAULT_GROUP_ICON;
}

/** What a group can be called: trimmed, not blank, at most 40 characters. */
export const GROUP_NAME_MAX = 40;

export function validateGroupName(name: string): string | null {
  const clean = name.trim();
  if (!clean) return 'Give the group a name.';
  if (clean.length > GROUP_NAME_MAX) return `Keep it under ${GROUP_NAME_MAX + 1} characters.`;
  return null;
}

/**
 * Moves the item at `from` to `to` in a copy of `list` (clamped to the ends).
 * Used for the move-up/move-down buttons when reordering a group.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const target = Math.max(0, Math.min(out.length - 1, to));
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item);
  return out;
}
