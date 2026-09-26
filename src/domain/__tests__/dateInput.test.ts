import { formatTypedDate, parseTypedDate } from '@/domain';

describe('parseTypedDate', () => {
  it.each([
    ['2026-10-12', '2026-10-12'],
    ['2026-1-2', '2026-01-02'],
    ['12/10/2026', '2026-10-12'],
    ['1/2/2026', '2026-02-01'],
    ['12-10-26', '2026-10-12'],
    ['12.10.2026', '2026-10-12'],
    [' 12 10 2026 ', '2026-10-12'],
    ['12 Oct 2026', '2026-10-12'],
    ['12 October 2026', '2026-10-12'],
    ['12th oct 2026', '2026-10-12'],
    ['3 Sept 2026', '2026-09-03'],
    ['29/02/2028', '2028-02-29'],
  ])('reads %p as %p', (text, iso) => {
    expect(parseTypedDate(text)).toBe(iso);
  });

  it.each(['', '   ', 'tomorrow', '31/02/2026', '29/02/2027', '12/13/2026', '2026-13-01', '12 Foo 2026', '12/10', '1/1/1'])(
    'rejects %p',
    (text) => {
      expect(parseTypedDate(text)).toBeNull();
    },
  );
});

describe('formatTypedDate', () => {
  it('writes day/month/year', () => {
    expect(formatTypedDate('2026-10-02')).toBe('02/10/2026');
    expect(parseTypedDate(formatTypedDate('2026-10-02'))).toBe('2026-10-02');
  });
});
