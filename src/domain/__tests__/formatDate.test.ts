import { formatDate, formatDateAs, getDateFormat, setDateFormat } from '@/domain';

afterEach(() => setDateFormat('medium'));

describe('formatDateAs', () => {
  it('writes day month year by default', () => {
    expect(formatDateAs('2026-10-12', 'medium')).toBe('12 Oct 2026');
    expect(formatDateAs('2027-01-01', 'medium')).toBe('1 Jan 2027');
  });

  it('writes ISO dates', () => {
    expect(formatDateAs('2026-10-12', 'iso')).toBe('2026-10-12');
  });

  it('writes the phone’s own style through Intl', () => {
    expect(formatDateAs('2026-10-12', 'locale', 'en-US')).toBe('Oct 12, 2026');
    expect(formatDateAs('2026-10-12', 'locale', 'en-GB')).toBe('12 Oct 2026');
    expect(formatDateAs('2026-10-12', 'locale', 'de-DE')).toMatch(/^12\. Okt\.? 2026$/);
  });

  it('refuses dates that are not real', () => {
    expect(() => formatDateAs('2026-02-30', 'iso')).toThrow();
  });
});

describe('formatDate', () => {
  it('follows the chosen format', () => {
    expect(getDateFormat()).toBe('medium');
    expect(formatDate('2026-06-20')).toBe('20 Jun 2026');
    setDateFormat('iso');
    expect(formatDate('2026-06-20')).toBe('2026-06-20');
  });
});
