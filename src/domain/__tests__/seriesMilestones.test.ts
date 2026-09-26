import { completionMessage, gapTipMessage, ownedWholePositions, seriesMilestones, type SeriesState } from '@/domain';

const state = (positions: (number | null)[], totalCount: number | null = null, name = 'Discworld'): SeriesState => ({ id: 7, name, totalCount, positions });

describe('gapTipMessage', () => {
  it('reads like Booky', () => {
    expect(gapTipMessage('Discworld', [1, 3], [2])).toBe('You have #1 and #3 of Discworld — #2 is missing.');
    expect(gapTipMessage('Discworld', [1, 2, 4, 6], [3, 5])).toBe('You have #1, #2, #4 and #6 of Discworld — #3 and #5 are missing.');
    expect(gapTipMessage('Discworld', [1, 2, 3, 4, 9], [5, 6, 7, 8])).toBe('You have 5 Discworld books — 4 are missing, starting with #5.');
  });
});

describe('completionMessage', () => {
  it('counts the books', () => {
    expect(completionMessage('Discworld', 9)).toBe('Series complete! All 9 Discworld books.');
    expect(completionMessage('Solo', 1)).toBe('Series complete! You have the Solo book.');
  });
});

describe('ownedWholePositions', () => {
  it('keeps distinct whole positions in order', () => {
    expect(ownedWholePositions([3, 1, 2.5, null, 1, 0])).toEqual([1, 3]);
  });
});

describe('seriesMilestones', () => {
  it('tips when a save creates a gap', () => {
    const [m] = seriesMilestones(state([1]), state([1, 3]));
    expect(m).toMatchObject({ type: 'series-gap', seriesId: 7, owned: [1, 3], gaps: [2], message: 'You have #1 and #3 of Discworld — #2 is missing.' });
  });

  it('tips when a book joins a series that already has a gap', () => {
    expect(seriesMilestones(state([1, 2, 4]), state([1, 2, 4, 5]))[0]).toMatchObject({ type: 'series-gap', gaps: [3] });
  });

  it('tips for a brand-new series with a gap', () => {
    expect(seriesMilestones(null, state([2]))[0]).toMatchObject({ type: 'series-gap', gaps: [1] });
  });

  it('says nothing when nothing changed, or when the gap closed', () => {
    expect(seriesMilestones(state([1, 3]), state([1, 3]))).toEqual([]);
    expect(seriesMilestones(state([1, 3]), state([1, 2, 3]))).toEqual([]);
    expect(seriesMilestones(state([1]), state([1, 2]))).toEqual([]);
    expect(seriesMilestones(state([1]), null)).toEqual([]);
  });

  it('says nothing about a series with only unnumbered books', () => {
    expect(seriesMilestones(state([null], 3), state([null, null], 3))).toEqual([]);
  });

  it('celebrates when the series becomes complete', () => {
    expect(seriesMilestones(state([1, 3], 3), state([1, 2, 3], 3))).toEqual([
      { type: 'series-complete', seriesId: 7, seriesName: 'Discworld', total: 3, message: 'Series complete! All 3 Discworld books.' },
    ]);
  });

  it('celebrates when setting the total completes it', () => {
    expect(seriesMilestones(state([1, 2]), state([1, 2], 2))[0]).toMatchObject({ type: 'series-complete', total: 2 });
  });

  it('never celebrates twice for edits that keep it complete', () => {
    expect(seriesMilestones(state([1, 2, 3], 3), state([1, 2, 3, 2.5], 3))).toEqual([]);
    expect(seriesMilestones(state([1, 2, 3], 3), state([1, 2, 3], 3))).toEqual([]);
  });

  it('needs a user-set total to call a series complete', () => {
    expect(seriesMilestones(state([1]), state([1, 2]))).toEqual([]);
  });
});
