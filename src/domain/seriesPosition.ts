import { parsePosition, POSITION_KEYWORD } from './seriesParser';

/**
 * Series positions as the user types and reads them (P04-02). Positions are
 * stored as REAL so a novella can sit at 2.5; display drops a trailing ".0".
 * Number parsing is shared with the metadata series parser (`parsePosition`);
 * this adds the wording people type around it ("Book 3", "vol. 2", "Part
 * Two", "#3 of 9", "2½").
 */

/** Positions are positive and below this (matches `parsePosition`). */
export const MAX_SERIES_POSITION = 10_000;

const PREFIX = new RegExp(String.raw`^(?:${POSITION_KEYWORD}(?!\p{L})\s*)?#?\s*`, 'iu');
const OF_TOTAL = /\s*(?:of|\/)\s*\S+$/i;
const HALF = /^(\d+)\s*½$/;

/**
 * "3", "#3", "Book 3", "vol. 2", "Part Two", "III", "3.5", "3,5", "2½",
 * "Book 3 of 9" → a position; null for blank or unreadable text.
 */
export function parseSeriesPosition(text: string | null | undefined): number | null {
  if (text == null) return null;
  const s = text.trim().replace(OF_TOTAL, '').replace(PREFIX, '').trim();
  if (!s) return null;
  const half = HALF.exec(s);
  if (half) return parsePosition(`${half[1]}.5`);
  return parsePosition(s);
}

export function isValidSeriesPosition(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0 && value < MAX_SERIES_POSITION;
}

/** 5 → "5", 2.5 → "2.5", 2.50000001 → "2.5"; "" for no position. Round-trips through `parseSeriesPosition`. */
export function formatSeriesPosition(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(Math.round(value * 1000) / 1000);
}

/** "Discworld #5", or just "Discworld" without a position. */
export function formatSeriesLabel(name: string, position: number | null | undefined): string {
  const pos = formatSeriesPosition(position);
  return pos ? `${name} #${pos}` : name;
}
