import { addDays, compareDates, daysBetween, isIsoDate, isOverdue, parseIsoDate, setToday, toIsoDate, today } from '@/domain';

describe('dates', () => {
  it('formats local calendar dates', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(today(new Date(2026, 8, 25, 0, 1))).toBe('2026-09-25');
  });

  it('can freeze today for the session and unfreeze it', () => {
    setToday('2026-03-14');
    expect(today()).toBe('2026-03-14');
    // An explicit clock still wins, so pure callers stay deterministic.
    expect(today(new Date(2026, 0, 2))).toBe('2026-01-02');
    setToday(null);
    expect(today()).toBe(toIsoDate(new Date()));
    expect(() => setToday('2026-02-30')).toThrow(/calendar date/);
  });

  it('parses and validates', () => {
    expect(parseIsoDate('2026-02-28').getDate()).toBe(28);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('26-2-3')).toBe(false);
    expect(() => parseIsoDate('nope')).toThrow(/YYYY-MM-DD/);
  });

  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('compares and measures', () => {
    expect(compareDates('2026-01-01', '2026-01-02')).toBeLessThan(0);
    expect(compareDates('2026-01-02', '2026-01-02')).toBe(0);
    expect(daysBetween('2026-09-20', '2026-09-25')).toBe(5);
    expect(daysBetween('2026-03-30', '2026-03-28')).toBe(-2);
  });

  it('knows when a loan is overdue', () => {
    expect(isOverdue({ dueOn: '2026-09-24', returnedOn: null }, '2026-09-25')).toBe(true);
    expect(isOverdue({ dueOn: '2026-09-25', returnedOn: null }, '2026-09-25')).toBe(false);
    expect(isOverdue({ dueOn: '2026-09-01', returnedOn: '2026-09-02' }, '2026-09-25')).toBe(false);
    expect(isOverdue({ dueOn: null, returnedOn: null }, '2026-09-25')).toBe(false);
  });
});
