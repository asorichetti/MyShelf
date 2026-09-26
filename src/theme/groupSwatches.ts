import { palette } from './tokens';

/**
 * The colours a user group can wear (P06-04). The group stores the swatch's
 * token name (`groups.colour`, e.g. "lavender"); the card paints its band in
 * `band` with the group's name and icon in `onBand`. Every pair meets WCAG AA
 * for normal text (4.5:1), checked in the theme tests.
 */
export interface GroupSwatch {
  /** Token name stored in the database. */
  name: string;
  /** Accessible name in the colour picker. */
  label: string;
  band: string;
  onBand: string;
}

export const groupSwatches: readonly GroupSwatch[] = [
  { name: 'lavender', label: 'Lavender', band: palette.plum100, onBand: palette.plum800 },
  { name: 'rose', label: 'Rose', band: palette.berry100, onBand: palette.berry800 },
  { name: 'sage', label: 'Sage', band: palette.moss100, onBand: palette.moss900 },
  { name: 'honey', label: 'Honey', band: palette.amber100, onBand: palette.amber900 },
  { name: 'sky', label: 'Sky', band: palette.sky100, onBand: palette.sky900 },
  { name: 'plum', label: 'Plum', band: palette.plum600, onBand: palette.white },
  { name: 'berry', label: 'Berry', band: palette.berry600, onBand: palette.white },
  { name: 'moss', label: 'Moss', band: palette.moss700, onBand: palette.white },
];

export const DEFAULT_GROUP_SWATCH = 'lavender';

/** The swatch for a stored colour, or the default one for an unknown or missing value. */
export function groupSwatch(name: string | null | undefined): GroupSwatch {
  return groupSwatches.find((s) => s.name === name) ?? groupSwatches.find((s) => s.name === DEFAULT_GROUP_SWATCH)!;
}
