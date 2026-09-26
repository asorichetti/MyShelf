/**
 * The English catalogue (P09-11): every word MyShelf shows or says, grouped
 * by feature. British English, curly quotes and apostrophes (AGENTS.md §3).
 *
 * - A key is the path to a message: `t('loans.screen.title')`.
 * - `{name}` is a placeholder, filled from the call's parameters.
 * - An object of plural categories (`one`, `other`, …) is a plural,
 *   chosen by the `count` parameter; so a group must not have a key named
 *   `other`.
 * - A comment above a key tells a translator where it shows.
 *
 * How to add a language: docs/localisation.md.
 */
export const en = {
  meta: {
    /** The language this catalogue is written in: plural rules and number formats follow it. */
    locale: 'en-GB',
  },

  // Shared words, dates and loan stamps
  /** Words used across the app: buttons, counts, list joins, field names, dates. */
  common: {
    cancel: 'Cancel',
    save: 'Save',
    back: 'Back',
    close: 'Close',
    done: 'Done',
    delete: 'Delete',
    remove: 'Remove',
    undo: 'Undo',
    retry: 'Retry',
    tryAgain: 'Try again',
    merge: 'Merge',
    addABook: 'Add a book',
    saveFailed: 'Sorry, I couldn’t save that. Please try again.',
    lookupFailed: 'Something went wrong while I was looking. Please try again.',
    /** "Discworld #5": a series and a book's place in it. */
    seriesLabel: '{name} #{position}',
    books: { one: '{count} book', other: '{count} books' },
    days: { one: '{count} day', other: '{count} days' },
    /** Joining names: "Terry Pratchett and Neil Gaiman", "A, B and C". */
    list: {
      pair: '{first} and {last}',
      separator: ', ',
      many: '{rest} and {last}',
    },
  },
  /** A book's fields, as the form and the change lists name them. */
  bookFields: {
    cover: 'Cover',
    title: 'Title',
    subtitle: 'Subtitle',
    authors: 'Authors',
    publisher: 'Publisher',
    year: 'Year',
    edition: 'Edition',
    format: 'Format',
    pages: 'Pages',
    language: 'Language',
    genres: 'Genres',
    series: 'Series',
    summary: 'Summary',
  },
  /** Calendar words; the order of day, month and year comes from Intl (see `formatDay`). */
  dates: {
    months: {
      jan: 'Jan',
      feb: 'Feb',
      mar: 'Mar',
      apr: 'Apr',
      may: 'May',
      jun: 'Jun',
      jul: 'Jul',
      aug: 'Aug',
      sep: 'Sep',
      oct: 'Oct',
      nov: 'Nov',
      dec: 'Dec',
    },
    /** Fallbacks for engines without `Intl.DateTimeFormat.formatToParts`. */
    dayMonthYear: '{day} {month} {year}',
    dayMonth: '{day} {month}',
    /** The date-format preference (P08-07). */
    formats: {
      locale: 'Your phone’s style',
      medium: 'Day month year (12 Oct 2026)',
      iso: 'Year-month-day (2026-10-12)',
    },
  },
  /** A loan's rubber stamp (shown in capitals) and what a screen reader says for it (P05-03). */
  loanStamp: {
    returned: 'Returned {date}',
    returnedDescription: 'Returned on {date}',
    overdue: { one: 'Overdue · {count} day', other: 'Overdue · {count} days' },
    overdueDescription: { one: 'Overdue by {count} day, it was due back on {date}', other: 'Overdue by {count} days, it was due back on {date}' },
    dueToday: 'Due today',
    dueTodayDescription: 'Due back today, on {date}',
    dueTomorrow: 'Due tomorrow',
    dueTomorrowDescription: 'Due back tomorrow, on {date}',
    due: 'Due {date}',
    dueSoonDescription: { one: 'Due back in {count} day, on {date}', other: 'Due back in {count} days, on {date}' },
    dueDescription: 'Due back on {date}',
    onLoan: 'On loan',
    onLoanDescription: 'On loan, no due date',
  },
} as const;
