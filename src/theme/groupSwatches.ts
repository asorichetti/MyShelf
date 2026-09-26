import { palette } from './tokens';

/**
 * The colours a user group can wear (P06-04). The group stores the swatch's
 * token name (`groups.colour`, e.g. "lavender"); the card paints its band in
 * `band` with the group's name and icon in `onBand`. Each swatch has a
 * night-library version for the dark theme (P09-02): soft pastels would glare
 * on dark card stock, so the pale ones become deep fills with light text.
 * Every pair meets WCAG AA for normal text (4.5:1), checked in the theme tests.
 */
export interface GroupSwatch {
  /** Token name stored in the database. */
  name: string;
  /** Accessible name in the colour picker. */
  label: string;
  band: string;
  onBand: string;
}

type Scheme = 'light' | 'dark';

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

/** The same swatches (same names, labels and order) on the dark theme. */
export const darkGroupSwatches: readonly GroupSwatch[] = [
  { name: 'lavender', label: 'Lavender', band: palette.plumNight, onBand: palette.lavender100 },
  { name: 'rose', label: 'Rose', band: palette.berryDusk, onBand: palette.berry200 },
  { name: 'sage', label: 'Sage', band: palette.mossNight, onBand: palette.moss200 },
  { name: 'honey', label: 'Honey', band: palette.amberDusk, onBand: palette.amber200 },
  { name: 'sky', label: 'Sky', band: palette.sky900, onBand: palette.sky100 },
  { name: 'plum', label: 'Plum', band: palette.plum600, onBand: palette.white },
  { name: 'berry', label: 'Berry', band: palette.berry600, onBand: palette.white },
  { name: 'moss', label: 'Moss', band: palette.moss700, onBand: palette.white },
];

export const DEFAULT_GROUP_SWATCH = 'lavender';

/** Every swatch for a colour scheme, in picker order. */
export function groupSwatchesFor(scheme: Scheme = 'light'): readonly GroupSwatch[] {
  return scheme === 'dark' ? darkGroupSwatches : groupSwatches;
}

/** The swatch for a stored colour, or the default one for an unknown or missing value. */
export function groupSwatch(name: string | null | undefined, scheme: Scheme = 'light'): GroupSwatch {
  const list = groupSwatchesFor(scheme);
  return list.find((s) => s.name === name) ?? list.find((s) => s.name === DEFAULT_GROUP_SWATCH)!;
}
