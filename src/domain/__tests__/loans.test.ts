/**
 * @jest-environment node
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  assertValidLoanDates,
  DEFAULT_LOAN_DAYS,
  daysOverdue,
  daysReturnedLate,
  daysUntilDue,
  defaultDueDate,
  isOverdue,
  loanStatus,
  LoanValidationError,
  normaliseLoanDays,
  settingDefaults,
  validateLoanDates,
  type IsoDate,
  type LoanIssue,
  type LoanStatus,
} from '@/domain';

const open = (dueOn: IsoDate | null) => ({ dueOn, returnedOn: null });

describe('loanStatus', () => {
  it.each<[string, { dueOn: IsoDate | null; returnedOn: IsoDate | null }, IsoDate, LoanStatus]>([
    ['no due date', open(null), '2026-09-25', 'on-loan'],
    ['due in 4 days', open('2026-09-29'), '2026-09-25', 'on-loan'],
    ['due in 3 days', open('2026-09-28'), '2026-09-25', 'due-soon'],
    ['due in 1 day', open('2026-09-26'), '2026-09-25', 'due-soon'],
    ['due today is due-soon, not overdue', open('2026-09-25'), '2026-09-25', 'due-soon'],
    ['due yesterday', open('2026-09-24'), '2026-09-25', 'overdue'],
    ['due long ago', open('2025-01-01'), '2026-09-25', 'overdue'],
    ['returned before due', { dueOn: '2026-09-30', returnedOn: '2026-09-20' }, '2026-09-25', 'returned'],
    ['returned after due', { dueOn: '2026-09-01', returnedOn: '2026-09-20' }, '2026-09-25', 'returned'],
    ['returned without due date', { dueOn: null, returnedOn: '2026-09-20' }, '2026-09-25', 'returned'],
    // month, year and leap-day rollovers
    ['due-soon across month end', open('2026-10-02'), '2026-09-29', 'due-soon'],
    ['on-loan across month end', open('2026-10-03'), '2026-09-29', 'on-loan'],
    ['due-soon across year end', open('2027-01-02'), '2026-12-30', 'due-soon'],
    ['overdue across year end', open('2026-12-31'), '2027-01-01', 'overdue'],
    ['due on leap day, checked the day before', open('2028-02-29'), '2028-02-28', 'due-soon'],
    ['due on leap day, checked the day after', open('2028-02-29'), '2028-03-01', 'overdue'],
    ['leap year: Feb 26 → Mar 1 is 4 days', open('2028-03-01'), '2028-02-26', 'on-loan'],
    ['common year: Feb 26 → Mar 1 is 3 days', open('2027-03-01'), '2027-02-26', 'due-soon'],
  ])('%s', (_, loan, day, expected) => {
    expect(loanStatus(loan, day)).toBe(expected);
    expect(isOverdue(loan, day)).toBe(expected === 'overdue');
  });
});

describe('daysOverdue / daysUntilDue / daysReturnedLate', () => {
  it.each<[string, { dueOn: IsoDate | null; returnedOn: IsoDate | null }, IsoDate, number, number | null, number]>([
    ['not due yet', open('2026-10-01'), '2026-09-25', 0, 6, 0],
    ['due today', open('2026-09-25'), '2026-09-25', 0, 0, 0],
    ['one day over', open('2026-09-24'), '2026-09-25', 1, -1, 0],
    ['over across a year', open('2026-12-30'), '2027-01-02', 3, -3, 0],
    ['over across leap day', open('2028-02-27'), '2028-03-01', 3, -3, 0],
    ['over across a common February', open('2027-02-27'), '2027-03-01', 2, -2, 0],
    ['no due date', open(null), '2026-09-25', 0, null, 0],
    ['returned on time', { dueOn: '2026-09-30', returnedOn: '2026-09-30' }, '2026-10-20', 0, null, 0],
    ['returned five days late', { dueOn: '2026-09-25', returnedOn: '2026-09-30' }, '2026-10-20', 0, null, 5],
    ['returned early', { dueOn: '2026-09-25', returnedOn: '2026-09-01' }, '2026-10-20', 0, null, 0],
  ])('%s', (_, loan, day, overdue, until, late) => {
    expect(daysOverdue(loan, day)).toBe(overdue);
    expect(daysUntilDue(loan, day)).toBe(until);
    expect(daysReturnedLate(loan)).toBe(late);
  });
});

describe('defaultDueDate', () => {
  it('defaults to 28 days, matching the setting default', () => {
    expect(DEFAULT_LOAN_DAYS).toBe(28);
    expect(settingDefaults.loanDays).toBe(DEFAULT_LOAN_DAYS);
    expect(defaultDueDate('2026-09-25')).toBe('2026-10-23');
  });

  it.each<[IsoDate, number | null, IsoDate]>([
    ['2026-09-25', 14, '2026-10-09'],
    ['2026-12-20', 14, '2027-01-03'],
    ['2028-02-15', 14, '2028-02-29'],
    ['2027-02-15', 14, '2027-03-01'],
    ['2026-01-31', 28, '2026-02-28'],
    ['2026-03-20', 21, '2026-04-10'],
    ['2026-09-25', 1, '2026-09-26'],
    ['2026-09-25', 365, '2027-09-25'],
    // unusable settings fall back to 28 days
    ['2026-09-25', null, '2026-10-23'],
    ['2026-09-25', 0, '2026-10-23'],
    ['2026-09-25', -7, '2026-10-23'],
    ['2026-09-25', 2.5, '2026-10-23'],
    ['2026-09-25', 100_000, '2026-10-23'],
  ])('%s + %p days → %s', (lentOn, days, expected) => {
    expect(defaultDueDate(lentOn, days)).toBe(expected);
  });

  it.each<[number | null | undefined, number]>([
    [14, 14],
    [3650, 3650],
    [3651, 28],
    [undefined, 28],
    [Number.NaN, 28],
  ])('normaliseLoanDays(%p) → %p', (days, expected) => {
    expect(normaliseLoanDays(days)).toBe(expected);
  });
});

describe('validateLoanDates', () => {
  const TODAY = '2026-09-25';
  it.each<[string, Parameters<typeof validateLoanDates>[0], IsoDate | undefined, LoanIssue[]]>([
    ['lent today, no due date', { lentOn: TODAY }, TODAY, []],
    ['due equals lent', { lentOn: TODAY, dueOn: TODAY }, TODAY, []],
    ['old loan already overdue is allowed', { lentOn: '2026-01-01', dueOn: '2026-02-01' }, TODAY, []],
    ['returned after due is allowed', { lentOn: '2026-01-01', dueOn: '2026-02-01', returnedOn: '2026-03-01' }, TODAY, []],
    ['returned the day it was lent', { lentOn: TODAY, returnedOn: TODAY }, TODAY, []],
    ['lent tomorrow', { lentOn: '2026-09-26' }, TODAY, [{ field: 'lentOn', code: 'lent-in-future' }]],
    ['future lent is fine without a today', { lentOn: '2026-09-26' }, undefined, []],
    ['due before lent', { lentOn: TODAY, dueOn: '2026-09-24' }, TODAY, [{ field: 'dueOn', code: 'due-before-lent' }]],
    [
      'returned before lent',
      { lentOn: '2026-09-20', returnedOn: '2026-09-19' },
      TODAY,
      [{ field: 'returnedOn', code: 'returned-before-lent' }],
    ],
    ['returned in the future', { lentOn: '2026-09-20', returnedOn: '2026-09-26' }, TODAY, [{ field: 'returnedOn', code: 'returned-in-future' }]],
    ['malformed lent date', { lentOn: '2026-9-1' }, TODAY, [{ field: 'lentOn', code: 'invalid-date' }]],
    ['impossible due date', { lentOn: '2026-02-01', dueOn: '2026-02-30' }, TODAY, [{ field: 'dueOn', code: 'invalid-date' }]],
    ['29 Feb in a common year', { lentOn: '2027-02-29' }, '2027-03-01', [{ field: 'lentOn', code: 'invalid-date' }]],
    ['29 Feb in a leap year', { lentOn: '2028-02-29' }, '2028-03-01', []],
    ['timestamp is not a calendar date', { lentOn: '2026-09-25T10:00:00Z' }, TODAY, [{ field: 'lentOn', code: 'invalid-date' }]],
    [
      'several problems at once',
      { lentOn: '2026-09-30', dueOn: '2026-09-01', returnedOn: 'soon' },
      TODAY,
      [
        { field: 'returnedOn', code: 'invalid-date' },
        { field: 'lentOn', code: 'lent-in-future' },
        { field: 'dueOn', code: 'due-before-lent' },
      ],
    ],
  ])('%s', (_, input, day, expected) => {
    expect(validateLoanDates(input, day)).toEqual(expected);
  });

  it('assertValidLoanDates throws a typed error listing the issues', () => {
    expect(() => assertValidLoanDates({ lentOn: TODAY })).not.toThrow();
    let caught: unknown;
    try {
      assertValidLoanDates({ lentOn: TODAY, dueOn: '2026-09-01' }, TODAY);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoanValidationError);
    expect((caught as LoanValidationError).issues).toEqual([{ field: 'dueOn', code: 'due-before-lent' }]);
    expect((caught as LoanValidationError).message).toMatch(/dueOn due-before-lent/);
  });
});

/**
 * Timezone behaviour needs a process whose TZ is set before it starts: Jest
 * sandboxes `process.env`, so assigning TZ inside a test changes nothing.
 * Each case runs the real domain module in a child Node process (via tsx)
 * with TZ set, and returns the results of the listed calls.
 */
type Call = [fn: string, ...args: unknown[]];
const DOMAIN = path.resolve(__dirname, '../index.ts');
const PROBE = `
  const d = require(${JSON.stringify(DOMAIN)});
  const revive = (a) => (a && typeof a === 'object' && 'utc' in a ? new Date(a.utc) : a);
  const calls = JSON.parse(process.env.CALLS);
  process.stdout.write(JSON.stringify({
    results: calls.map(([fn, ...args]) => d[fn](...args.map(revive))),
  }));
`;
const run = promisify(execFile);
async function inTimeZone(tz: string, calls: Call[]): Promise<unknown[]> {
  const { stdout } = await run(process.execPath, ['--import', 'tsx', '-e', PROBE], {
    cwd: path.resolve(__dirname, '../../..'),
    env: { ...process.env, TZ: tz, CALLS: JSON.stringify(calls) },
  });
  return (JSON.parse(stdout) as { results: unknown[] }).results;
}
const at = (iso: string) => ({ utc: Date.parse(iso) });

describe('timezones and daylight saving (child processes)', () => {
  jest.setTimeout(30_000);

  // 02:00 UTC on 26 September 2026: still the 25th in the Americas, the 26th elsewhere.
  const instant = at('2026-09-26T02:00:00Z');
  const loan = open('2026-09-25');
  it.each<[string, IsoDate, LoanStatus, number]>([
    ['Pacific/Pago_Pago', '2026-09-25', 'due-soon', 0],
    ['America/Los_Angeles', '2026-09-25', 'due-soon', 0],
    ['America/New_York', '2026-09-25', 'due-soon', 0],
    ['UTC', '2026-09-26', 'overdue', 1],
    ['Europe/London', '2026-09-26', 'overdue', 1],
    ['Asia/Kolkata', '2026-09-26', 'overdue', 1],
    ['Pacific/Kiritimati', '2026-09-26', 'overdue', 1],
  ])('the same instant in %s is %s, so a loan due on the 25th is %s', async (tz, day, status, overdue) => {
    expect(
      await inTimeZone(tz, [
        ['today', instant],
        ['loanStatusAt', loan, instant],
        ['daysOverdue', loan, day],
        ['defaultDueDate', '2026-09-25', 14],
      ]),
    ).toEqual([day, status, overdue, '2026-10-09']);
  });

  it.each<[string, IsoDate, IsoDate, number]>([
    // spring forward (23-hour days)
    ['Europe/London', '2026-03-28', '2026-03-30', 2],
    ['America/New_York', '2026-03-07', '2026-03-09', 2],
    ['Australia/Lord_Howe', '2026-10-03', '2026-10-05', 2],
    // fall back (25-hour days)
    ['Europe/London', '2026-10-24', '2026-10-26', 2],
    ['America/New_York', '2026-10-31', '2026-11-02', 2],
    ['Australia/Lord_Howe', '2026-04-04', '2026-04-06', 2],
    // DST that began at midnight: local midnight on 4 November 2018 did not exist
    ['America/Sao_Paulo', '2018-11-03', '2018-11-05', 2],
    // a whole loan period spanning a transition
    ['Europe/London', '2026-03-15', '2026-04-12', 28],
    ['America/New_York', '2026-10-20', '2026-11-17', 28],
  ])('%s: %s → %s is %p days', async (tz, from, to, days) => {
    expect(
      await inTimeZone(tz, [
        ['daysBetween', from, to],
        ['addDays', from, days],
        ['addDays', to, -days],
        ['daysOverdue', open(from), to],
        ['defaultDueDate', from, days],
      ]),
    ).toEqual([days, to, from, days, to]);
  });

  it('steps through a midnight DST gap one day at a time', async () => {
    expect(
      await inTimeZone('America/Sao_Paulo', [
        ['addDays', '2018-11-03', 1],
        ['addDays', '2018-11-04', 1],
        ['loanStatus', open('2018-11-04'), '2018-11-04'],
        ['loanStatus', open('2018-11-04'), '2018-11-05'],
        ['isIsoDate', '2018-11-04'],
      ]),
    ).toEqual(['2018-11-04', '2018-11-05', 'due-soon', 'overdue', true]);
  });

  it('turns overdue at local midnight on the day DST starts', async () => {
    // Europe/London: 23:59 BST on 29 March 2026 is 22:59 UTC; midnight on the 30th is 23:00 UTC.
    expect(
      await inTimeZone('Europe/London', [
        ['loanStatusAt', open('2026-03-29'), at('2026-03-29T22:59:00Z')],
        ['loanStatusAt', open('2026-03-29'), at('2026-03-29T23:00:00Z')],
      ]),
    ).toEqual(['due-soon', 'overdue']);
  });
});

describe('a due date that is not a real date (a corrupt row, P09-04)', () => {
  const odd = { dueOn: 'zzz', returnedOn: null };
  it('counts as undated instead of throwing', () => {
    expect(loanStatus(odd, '2026-06-20')).toBe('on-loan');
    expect(daysOverdue(odd, '2026-06-20')).toBe(0);
    expect(daysUntilDue(odd, '2026-06-20')).toBeNull();
    expect(daysReturnedLate({ dueOn: 'zzz', returnedOn: '2026-06-20' })).toBe(0);
    expect(daysReturnedLate({ dueOn: '2026-06-01', returnedOn: 'later' })).toBe(0);
  });
});
