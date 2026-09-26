import {
  isRating,
  minRatingLabel,
  parseRating,
  ratedPhrase,
  ratingAnnouncement,
  ratingForKey,
  ratingSectionTitle,
  ratingValueText,
  starsText,
  stepRating,
  tapRating,
  validateBookDraft,
  emptyDraft,
} from '@/domain';

describe('ratings', () => {
  it('knows a rating: 1 to 5 whole stars', () => {
    expect([1, 2, 3, 4, 5].every(isRating)).toBe(true);
    for (const bad of [0, 6, 4.5, -1, Number.NaN, '4', null, undefined]) expect(isRating(bad)).toBe(false);
    expect(parseRating('4')).toBe(4);
    expect(parseRating(' 5 ')).toBe(5);
    for (const bad of ['0', '6', '4.5', '', 'five', 0, null]) expect(parseRating(bad)).toBeNull();
  });

  it('words: plurals, the control value, the row phrase and the announcement', () => {
    expect(starsText(1)).toBe('1 star');
    expect(starsText(4)).toBe('4 stars');
    expect(ratingValueText(4)).toBe('4 out of 5 stars');
    expect(ratingValueText(null)).toBe('Not rated');
    expect(ratedPhrase(4)).toBe('rated 4 out of 5');
    expect(ratedPhrase(null)).toBeNull();
    expect(ratedPhrase(undefined)).toBeNull();
    expect(ratingAnnouncement(4)).toBe('Rated 4 stars');
    expect(ratingAnnouncement(1)).toBe('Rated 1 star');
    expect(ratingAnnouncement(null)).toBe('Rating cleared');
    expect(minRatingLabel(3)).toBe('3 stars and up');
    expect(minRatingLabel(1)).toBe('1 star and up');
    expect(minRatingLabel(5)).toBe('5 stars');
    expect(ratingSectionTitle(1)).toBe('1 star');
  });

  it('a tap on the current star clears it; any other star sets it', () => {
    expect(tapRating(null, 3)).toBe(3);
    expect(tapRating(3, 5)).toBe(5);
    expect(tapRating(4, 4)).toBeNull();
  });

  it('keys follow the slider pattern from not rated (0) to 5', () => {
    expect(ratingForKey(null, 'ArrowRight')).toBe(1);
    expect(ratingForKey(3, 'ArrowUp')).toBe(4);
    expect(ratingForKey(5, 'ArrowRight')).toBe(5);
    expect(ratingForKey(3, 'ArrowLeft')).toBe(2);
    expect(ratingForKey(1, 'ArrowDown')).toBeNull();
    expect(ratingForKey(null, 'ArrowLeft')).toBeNull();
    expect(ratingForKey(4, 'Home')).toBeNull();
    expect(ratingForKey(2, 'End')).toBe(5);
    expect(ratingForKey(2, '4')).toBe(4);
    expect(ratingForKey(2, '0')).toBeNull();
    expect(ratingForKey(2, 'Delete')).toBeNull();
    expect(ratingForKey(2, 'Backspace')).toBeNull();
    expect(ratingForKey(2, 'Tab')).toBeUndefined();
    expect(ratingForKey(2, '7')).toBeUndefined();
    expect(ratingForKey(2, 'Enter')).toBeUndefined();
  });

  it('TalkBack steps one star at a time, down to not rated', () => {
    expect(stepRating(null, 1)).toBe(1);
    expect(stepRating(5, 1)).toBe(5);
    expect(stepRating(1, -1)).toBeNull();
    expect(stepRating(null, -1)).toBeNull();
  });

  it('a draft carries a valid rating and drops anything else', () => {
    const ok = (rating: number | null) => {
      const v = validateBookDraft({ ...emptyDraft(), title: 'Dune', rating });
      if (!v.ok) throw new Error('invalid');
      return v.value.rating;
    };
    expect(ok(3)).toBe(3);
    expect(ok(null)).toBeNull();
    expect(ok(9)).toBeNull();
  });
});
