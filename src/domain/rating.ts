import { t } from '@/i18n';

/**
 * The reader's own rating of a book (P10): whole stars from 1 to 5, or null
 * for "not rated". A rating is the user's opinion: lookups, refreshes and
 * imports of catalogue data never change it (a Goodreads import carries the
 * user's own "My Rating").
 */

export const MAX_RATING = 5;
export const ratingValues = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof ratingValues)[number];

export function isRating(value: unknown): value is Rating {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_RATING;
}

/** A stored or typed value as a rating; anything else (0, 4.5, "", "five") is null, "not rated". */
export function parseRating(value: unknown): Rating | null {
  if (isRating(value)) return value;
  if (typeof value === 'string' && /^\s*[1-5]\s*$/.test(value)) return Number(value.trim()) as Rating;
  return null;
}

/** "1 star", "4 stars". */
export function starsText(n: number): string {
  return t('rating.stars', { count: n });
}

/** What the rating control says: "Rating: 4 out of 5 stars", "Rating: not rated". */
export function ratingValueText(rating: number | null): string {
  return rating == null ? t('rating.notRated') : t('rating.valueText', { rating, max: MAX_RATING });
}

/** For a book's accessible name: "rated 4 out of 5"; null when not rated. */
export function ratedPhrase(rating: number | null | undefined): string | null {
  return rating == null ? null : t('rating.rated', { rating, max: MAX_RATING });
}

/** What is announced after a change: "Rated 4 stars", "Rating cleared". */
export function ratingAnnouncement(rating: number | null): string {
  return rating == null ? t('rating.cleared') : t('rating.announce', { count: rating });
}

/** A Shelf filter chip and choice: "5 stars", "4 stars and up". */
export function minRatingLabel(min: number): string {
  return min >= MAX_RATING ? starsText(MAX_RATING) : t('rating.andUp', { count: min });
}

/** A Shelf section when grouping by rating: "5 stars", "1 star". */
export function ratingSectionTitle(rating: number): string {
  return starsText(rating);
}

/**
 * Tapping a star: the same star again clears the rating (a second tap on
 * "4" undoes it), any other star sets it.
 */
export function tapRating(current: number | null, star: number): Rating | null {
  return current === star ? null : (star as Rating);
}

/**
 * A key on the focused rating control (the WAI-ARIA slider keys), from 0
 * ("not rated") to 5: right or up adds a star, left or down takes one away
 * (from 1 star to not rated), Home clears, End gives 5 stars, a digit 1-5
 * sets it, 0 / Delete / Backspace clear. Returns undefined for any other key.
 */
export function ratingForKey(current: number | null, key: string): Rating | null | undefined {
  const now = current ?? 0;
  const clamp = (n: number) => (n <= 0 ? null : (Math.min(n, MAX_RATING) as Rating));
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(now + 1);
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(now - 1);
    case 'Home':
    case 'Delete':
    case 'Backspace':
    case '0':
      return null;
    case 'End':
      return MAX_RATING;
    default:
      return /^[1-5]$/.test(key) ? (Number(key) as Rating) : undefined;
  }
}

/** TalkBack's swipe up / down on the control. */
export function stepRating(current: number | null, step: 1 | -1): Rating | null {
  return ratingForKey(current, step > 0 ? 'ArrowRight' : 'ArrowLeft') ?? null;
}
