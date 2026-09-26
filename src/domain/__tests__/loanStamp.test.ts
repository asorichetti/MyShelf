import { formatShortDate, loanStamp, type IsoDate } from '@/domain';

const open = (dueOn: IsoDate | null) => ({ dueOn, returnedOn: null });
const today = '2026-06-15';

describe('loanStamp', () => {
  it.each<[string, { dueOn: IsoDate | null; returnedOn: IsoDate | null }, string, string, string]>([
    ['no due date', open(null), 'On loan', 'accent', 'On loan, no due date'],
    ['due later', open('2026-07-01'), 'Due 1 Jul', 'accent', 'Due back on 1 Jul 2026'],
    ['due in 3 days', open('2026-06-18'), 'Due 18 Jun', 'warn', 'Due back in 3 days, on 18 Jun 2026'],
    ['due tomorrow', open('2026-06-16'), 'Due tomorrow', 'warn', 'Due back tomorrow, on 16 Jun 2026'],
    ['due today', open('2026-06-15'), 'Due today', 'warn', 'Due back today, on 15 Jun 2026'],
    ['one day over', open('2026-06-14'), 'Overdue · 1 day', 'danger', 'Overdue by 1 day, it was due back on 14 Jun 2026'],
    ['five days over', open('2026-06-10'), 'Overdue · 5 days', 'danger', 'Overdue by 5 days, it was due back on 10 Jun 2026'],
    ['returned', { dueOn: '2026-06-10', returnedOn: '2026-06-12' }, 'Returned 12 Jun', 'success', 'Returned on 12 Jun 2026'],
    ['due next year', open('2027-01-04'), 'Due 4 Jan 2027', 'accent', 'Due back on 4 Jan 2027'],
  ])('%s', (_, loan, label, tone, description) => {
    expect(loanStamp(loan, today)).toMatchObject({ label, tone, description });
  });

  it('always says the status in words, so colour is never the only cue', () => {
    for (const loan of [open(null), open('2026-06-10'), open('2026-06-16'), { dueOn: null, returnedOn: '2026-06-01' }]) {
      const { label, status } = loanStamp(loan, today);
      expect(label).toMatch(status === 'overdue' ? /Overdue/ : status === 'returned' ? /Returned/ : /Due|On loan/);
    }
  });
});

describe('formatShortDate', () => {
  it('drops the year only within the same year', () => {
    expect(formatShortDate('2026-10-12', '2026-06-15')).toBe('12 Oct');
    expect(formatShortDate('2027-10-12', '2026-06-15')).toBe('12 Oct 2027');
    expect(formatShortDate('2026-10-12')).toBe('12 Oct 2026');
  });
});
