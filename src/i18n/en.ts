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

  // Navigation and the shared controls
  /** The tab bar, and the screens shown while loading, when something is missing and when something breaks. */
  navigation: {
    tabs: {
      shelf: 'Shelf',
      scan: 'Scan',
      loans: 'Loans',
      groups: 'Groups',
      settings: 'Settings',
      /** The Loans tab's name when some loans are overdue. */
      loansOverdue: '{tab}, {count} overdue',
    },
    loading: {
      library: 'Opening your library…',
      /** A pushed page's loading line. */
      page: 'Fetching the cards from the drawer…',
    },
    databaseError: {
      title: "I couldn't open your library",
      message: "Something went wrong opening the catalogue on this device. Your books are safe; let's try again.",
    },
    notFound: {
      /** The browser tab's title for an unknown address. */
      documentTitle: 'Not found',
      title: 'Page not found',
      message: "I've searched every shelf, but this page isn't in the catalogue.",
      home: 'Back to my shelf',
    },
    missing: {
      goBack: 'Go back',
    },
    screenError: {
      title: 'Something went wrong here',
      message: 'This page tripped over something. Your books are safe; let’s try that again.',
      goToShelf: 'Go to my shelf',
      /** Android and iOS: the details go to the share sheet, which offers Copy. */
      share: 'Share error details',
      /** Web: straight onto the clipboard. */
      copy: 'Copy error details',
      copied: 'Copied. It stays on this phone unless you paste it somewhere.',
      copyFailed: 'Couldn’t copy them; the details are below.',
    },
  },
  /** The shared controls in `src/components/ui`. */
  ui: {
    dialog: {
      confirm: 'Confirm',
    },
    topBar: {
      back: 'Back',
    },
    chip: {
      remove: 'Remove {label}',
    },
    select: {
      notSet: 'Not set',
      hint: 'Opens a list to choose from',
      /** The field's accessible name: its label and current value. */
      value: '{label}: {value}',
    },
    dateField: {
      placeholder: 'DD/MM/YYYY',
      hint: 'Day, month, year, for example 12/10/2026',
      webHint: 'Type the date or open the calendar',
      /** {field} is the field's label in lower case ("due date"). */
      calendar: 'Choose {field} from a calendar',
    },
    letterIndex: {
      label: 'Jump to letter',
      jumpTo: 'Jump to {letter}',
      /** How "#" is read out. */
      numbersAndSymbols: 'numbers and symbols',
    },
    catalogueCard: {
      isbn: 'ISBN {isbn}',
    },
  },

  // Lending
  /** The Loans tab, a book's loan section, loan rows and the Shelf row's loan words (P05). */
  loans: {
    markReturned: 'Mark returned',
    /** A borrower whose name could not be read: "“Dune” is already on loan to someone." */
    someone: 'someone',
    screen: {
      title: 'Loans',
      loading: 'Checking the loan drawer…',
      intro: 'Who has your books, and when they’re due back.',
      /** Shown as a red stamp under the title. */
      overdueCount: { one: '{count} book overdue', other: '{count} books overdue' },
      /** Tab label with the number of loans in it. */
      tabOut: 'Out now · {count}',
      tabOutName: 'Out now',
      tabHistory: 'History · {count}',
      tabHistoryName: 'History',
      borrowerFilter: 'Borrower',
      /** The borrower filter with no one chosen. */
      everyone: 'Everyone',
    },
    empty: {
      borrowerNothingOutTitle: '{name} has nothing out',
      borrowerNothingOutMessage: 'Everything they borrowed is back on your shelf.',
      showEveryone: 'Show everyone',
      allHomeTitle: 'Every book is home. Lovely.',
      allHomeMessage: 'When you lend a book I’ll stamp the due date here, and give you a gentle nudge if it’s late. Lend one from its page on your shelf.',
      goToShelf: 'Go to your shelf',
      historyTitle: 'Nothing has come back yet',
      historyBorrowerTitle: 'Nothing back from {name} yet',
      historyMessage: 'Returned loans are kept here, newest first.',
      seeWhatsOut: 'See what’s out',
    },
    row: {
      openBook: 'Open {title}',
      lent: 'Lent {date}',
      lentAndBack: 'Lent {lent}, back {back}',
      /** Before the borrower's name on an open loan: "With Sam". */
      with: 'With',
      /** Before the borrower's name on a returned loan: "Borrowed by Sam". */
      borrowedBy: 'Borrowed by',
      borrowerLabel: '{name}, see everything they have borrowed',
      markReturnedLabel: 'Mark {title} returned',
    },
    stamp: {
      /** A stamp with a prefix, e.g. "On loan · Sam · Due 12 Oct". */
      withPrefix: '{prefix} · {label}',
      /** What a screen reader says for a stamp with a prefix. */
      withPrefixDescription: '{prefix}. {description}',
    },
    bookSection: {
      stampPrefix: 'On loan · {name}',
      summaryNoDue: 'Lent to {name} on {date}. No due date.',
      summaryDue: 'Lent to {name} on {date}. Due back on {due}.',
      summaryOverdue: {
        one: 'Lent to {name} on {date}. It was due back on {due} ({count} day ago).',
        other: 'Lent to {name} on {date}. It was due back on {due} ({count} days ago).',
      },
      note: 'Note: {note}',
      aboutBorrower: 'About {name}',
      aboutBorrowerLabel: 'See everything {name} has borrowed',
      /** The rubber stamp shown briefly after a return. */
      returnedStamp: 'Returned',
      onShelf: 'On the shelf, not lent to anyone.',
      lend: 'Lend',
      lendLabel: 'Lend {title}',
      lent: 'Lent to {name}',
      alreadyOnLoanTo: '“{title}” is already on loan to {name}.',
      alreadyOnLoan: '“{title}” is already on loan.',
    },
    /** Booky's overdue nudge: "“Dune” was due back from Sam 3 days ago." */
    overdue: {
      nudge: '“{title}” was due back from {borrower} {when}.',
      yesterday: 'yesterday',
      daysAgo: { one: '{count} day ago', other: '{count} days ago' },
    },
    /** Words a Shelf row adds to its accessible name for a book on loan. */
    shelf: {
      onLoanTo: 'on loan to {name}',
      onLoanToOverdue: 'on loan to {name}, overdue',
      onLoan: 'on loan',
      onLoanOverdue: 'on loan, overdue',
      /** The Shelf row's stamp for an overdue loan. */
      overdueStamp: 'Overdue',
    },
  },
  /** The lend sheet and its borrower picker. */
  lend: {
    sheet: {
      title: 'Lend “{title}”',
      subtitle: 'I’ll stamp the due date and keep an eye on it for you.',
      save: 'Lend',
      lentOn: 'Lent on',
      dueBack: 'Due back',
      /** Under the due date: the loan-length setting. */
      dueHelp: { one: '{count} day after lending, unless you change it', other: '{count} days after lending, unless you change it' },
      noDueDate: 'No due date',
      note: 'Note (optional)',
      notePlaceholder: 'e.g. Bring it to book club',
    },
    errors: {
      chooseBorrower: 'Choose who’s borrowing it, or add their name.',
      dueRequired: 'Enter a due date, or choose “No due date”.',
      borrowerRemoved: 'That borrower has just been removed. Choose someone else.',
      bookMissing: 'This book is no longer on your shelf.',
      saveFailed: 'Sorry, I couldn’t save that loan. Please try again.',
    },
    /** Date problems in the lend and return sheets. */
    issues: {
      invalidDue: 'Enter a due date like 12/10/2026, or choose “No due date”.',
      invalidReturned: 'Enter the day it came back, like 12/10/2026.',
      invalidLent: 'Enter the day you lent it, like 12/10/2026.',
      lentInFuture: 'The day you lent it can’t be in the future.',
      dueBeforeLent: 'The due date can’t be before the day you lent it.',
      returnedBeforeLent: 'It can’t come back before the day it was lent.',
      returnedInFuture: 'The return date can’t be in the future.',
    },
    picker: {
      newBorrower: 'New borrower',
      lendingTo: 'Lending to',
      change: 'Change',
      changeLabel: 'Change borrower (now {name})',
      contactLabel: 'How to reach {name} (optional)',
      contactHelp: 'Phone, email or where they live — just for you.',
      search: 'Who’s borrowing it?',
      searchPlaceholder: 'A name, like Sam',
      helpPick: 'Pick someone below or type a new name.',
      helpType: 'Type their name.',
      duplicate: '{name} already exists — use them?',
      useExisting: 'Use {name}',
      addNew: 'Add someone new',
      addNewLabel: 'Add a different {name}',
      create: 'Add “{name}”',
      createLabel: 'Add {name} as a new borrower',
      /** Under a suggested borrower's name. */
      captionHasNow: { one: 'Has {count} book now', other: 'Has {count} books now' },
      captionBorrowedBefore: { one: 'Borrowed once before', other: 'Borrowed {count} times before' },
      captionNotYet: 'Not borrowed anything yet',
      /** What a screen reader says for a suggested borrower. */
      optionHasNow: { one: 'Lend to {name}, has {count} book now', other: 'Lend to {name}, has {count} books now' },
      optionBorrowedBefore: { one: 'Lend to {name}, borrowed once before', other: 'Lend to {name}, borrowed {count} times before' },
      optionNotYet: 'Lend to {name}, not borrowed anything yet',
    },
  },
  /** Marking a loan returned, and undoing it. */
  returnLoan: {
    sheet: {
      title: 'Mark “{title}” returned?',
      subtitle: 'Lent to {name} on {date}.',
      notYet: 'Not yet',
      date: 'Came back on',
    },
    welcomeHome: 'Welcome home, “{title}”!',
    lentAgain: '“{title}” has gone out on a new loan since, so I kept this one closed.',
    undoFailed: 'Sorry, I couldn’t undo that.',
  },
  /** A borrower's page and Settings → Borrowers. */
  borrowers: {
    screen: {
      card: 'Borrower’s card',
      noContact: 'No contact details. Add some with Edit — they stay on this phone.',
      currentHeading: 'Currently has',
      currentEmpty: 'Nothing right now — every book is home.',
      pastHeading: 'Has borrowed before',
      pastEmpty: 'No returned loans yet.',
      loading: 'Finding their card…',
      missingTitle: 'Borrower not found',
      missingMessage: 'I can’t find that borrower. They may have been removed.',
      backToLoans: 'Back to loans',
    },
    /** Under a borrower's name: "Has 1 book now · borrowed 3 times since 5 Jun 2025". */
    stats: {
      never: 'Hasn’t borrowed anything yet',
      hasNow: { one: 'Has {count} book now', other: 'Has {count} books now' },
      nothingOut: 'Has nothing out',
      /** {now} is "Has 1 book now" or "Has nothing out"; {count} is every loan they have had. */
      line: { one: '{now} · borrowed once since {date}', other: '{now} · borrowed {count} times since {date}' },
    },
    edit: {
      title: 'Edit {name}',
      name: 'Name',
      contact: 'How to reach them (optional)',
      saved: 'Saved',
      duplicate: '{name} is already a borrower. Pick a different name.',
      blank: 'Give them a name.',
      gone: 'This borrower has been removed.',
    },
    remove: {
      label: 'Remove {name}',
      removed: 'Removed {name}',
      failed: 'Sorry, I couldn’t remove {name}. Please try again.',
      confirmTitle: 'Remove {name}?',
      clearsHistory: {
        one: 'This also clears their lending history ({count} past loan). Your books stay on your shelf.',
        other: 'This also clears their lending history ({count} past loans). Your books stay on your shelf.',
      },
      nothingElse: 'They haven’t borrowed anything, so nothing else changes.',
      keep: 'Keep',
      /** Removing is refused while they still have books out. */
      blocked: {
        one: '{name} still has {count} book of yours. Mark it returned first, then you can remove {name}.',
        other: '{name} still has {count} books of yours. Mark them returned first, then you can remove {name}.',
      },
    },
    settings: {
      title: 'Borrowers',
      intro: 'The people you lend to. Open someone to see what they have and what they’ve borrowed before.',
      emptyTitle: 'No borrowers yet',
      emptyMessage: 'When you lend a book, the person you lend it to appears here.',
      rowLabel: '{name}, {line}',
      /** "has 1 book now · 3 loans in all": {now} and {all} are the two keys below. */
      line: '{now} · {all}',
      hasNow: { one: 'has {count} book now', other: 'has {count} books now' },
      nothingNow: 'has nothing now',
      loansInAll: { one: '{count} loan in all', other: '{count} loans in all' },
    },
  },
  /** "Lending history" on book detail. */
  loanHistory: {
    title: 'Lending history',
    count: { one: '{count} past loan', other: '{count} past loans' },
    toggleLabel: { one: 'Lending history, {count} past loan', other: 'Lending history, {count} past loans' },
    /** From the day it was lent to the day it came back. */
    range: '{from} – {to}',
  },
  /** Due-date reminders (P05-08). */
  reminders: {
    switch: {
      label: 'Remind me when loans are due',
      hint: 'A notification at 10:00 on the day a lent book is due back',
      caption: 'A note at 10:00 on the day a lent book is due back. Nothing leaves your phone.',
    },
    notification: {
      title: '“{title}” is due back today',
      body: '{name} has it. A gentle reminder, no rush.',
    },
    /** The Android notification channel, as the phone's settings list it. */
    channel: {
      name: 'Loan reminders',
      description: 'A note on the day a lent book is due back',
    },
  },

  // Series and groups
  /** Series: the list, a series' page and the words that summarise one (P04). */
  series: {
    /** A place in a series, e.g. "#3" (a gap, a book's number). */
    number: '#{position}',
    /** How a series' progress reads in lists and on its page. */
    progress: {
      /** Short form beside a series' name: "5 of 9". */
      short: '{owned} of {total}',
      noBooksYet: 'No books yet',
      /** "2 books, not numbered": {books} is the book count ("2 books"). */
      notNumbered: '{books}, not numbered',
      /** "5 of 9 owned, 2 missing": {tail} is one of the three endings below. */
      sentence: '{owned} of {total} owned, {tail}',
      missing: { one: '{count} missing', other: '{count} missing' },
      complete: 'complete',
      noneMissing: 'none missing so far',
      /** What a screen reader says for a series: "Discworld, 5 of 9 owned, 2 missing". */
      label: '{name}, {progress}',
    },
    row: {
      complete: 'Complete!',
    },
    miniSpines: {
      /** More spines than fit on the mini shelf: "+4". */
      more: '+{count}',
    },
    bookList: {
      label: '{name} in reading order',
      /** Shown in the number column for a book with no place in the series. */
      unnumbered: '—',
      /** Screen reader's name for a book's place: "Number 3". */
      numberLabel: 'Number {position}',
      notNumbered: 'Not numbered',
      /** "Number 1, The Colour of Magic": {number} is "Number 1" or "Not numbered". */
      bookLabel: '{number}, {title}',
      /** "Number 1, The Colour of Magic, 1983". */
      bookLabelWithYear: '{number}, {title}, {year}',
      gapMissing: '#{position} missing',
      addGap: 'Add #{position}',
      addGapLabel: 'Add number {position} of {name}',
    },
    list: {
      loading: 'Lining up your series…',
      errorTitle: 'Couldn’t open your series',
      errorMessage: 'Something went wrong reading the catalogue. Please try again.',
      title: 'Series',
      intro: 'Every series on your shelf, with the gaps showing.',
      introEmpty: 'Books that belong together, in order.',
      sortLabel: 'Sort series',
      sortName: 'A to Z',
      sortRecent: 'Recently added',
      listLabel: 'Your series',
      emptyTitle: 'No series yet',
      emptyMessage: 'When a book is part of a series, add the series on its card and it lines up here, in order, with any gaps showing.',
    },
    detail: {
      loading: 'Taking the series down from the shelf…',
      allSeries: 'All series',
      moreActions: 'More actions',
      moreActionsFor: 'More actions for {name}',
      rename: 'Rename series',
      merge: 'Merge into another series',
      delete: 'Delete series',
      /** Small label above the series' name. */
      eyebrow: 'Series',
      progressBar: 'Books owned',
      readingOrder: 'In reading order',
      emptyTitle: 'No books here yet',
      emptyMessage: 'Add the first book and it takes its place on this shelf.',
      addFirst: 'Add #1',
      noGapsYet: 'No gaps so far. Tell me how many books the series has to see what’s still to come.',
      length: 'Length',
      renamed: 'Renamed to {name}',
      merged: 'Merged into {name}',
      deleted: 'Deleted the series {name}',
      deleteFailed: 'Sorry, I couldn’t delete that. Please try again.',
      notFoundTitle: 'Series not found',
      notFoundMessage: 'I couldn’t find that series. It may have been merged or deleted.',
    },
    /** The "How many books are in this series?" field on a series' page. */
    total: {
      label: 'How many books are in this series?',
      placeholder: 'Not sure',
      helper: 'Leave it empty if you’re not sure. Gaps then run up to your highest number.',
      saveLabel: 'Save the number of books',
      notWhole: 'Use a whole number, like 9.',
      /** The user typed a total below a number they own: "You already have #12, so it has at least 12." */
      tooSmall: 'You already have #{position}, so it has at least {min}.',
      cleared: 'I’ll work out the length of {name} from your books',
      /** {books} is the count, e.g. "9 books". */
      saved: 'Saved: {name} has {books}',
    },
    renameDialog: {
      title: 'Rename series',
      message: 'The new name shows on every book in the series.',
      confirm: 'Rename',
      nameLabel: 'Series name',
      nameRequired: 'A series needs a name.',
    },
    mergeDialog: {
      title: 'Merge “{name}” into…',
      /** {books} is the count, e.g. "3 books"; {target} is the series they move to. */
      confirmMessage: 'Move {books} into {target}, keeping their numbers, and remove “{name}”?',
      pick: 'Pick the series these books really belong to.',
      noOthers: 'There’s no other series to merge into yet.',
      optionsLabel: 'Series to merge into',
      /** A series to merge into: "Discworld, 41 books". */
      optionLabel: '{name}, {books}',
    },
    deleteDialog: {
      title: 'Delete this series?',
      /** {books} is the count, e.g. "3 books". */
      message: 'The {books} stay on your shelf, just not as “{name}”.',
      messageEmpty: '“{name}” has no books; it just goes.',
      keep: 'Keep it',
    },
  },
  /** Booky's series tips (P04-07, P04-08): "You have #1 and #3 of Discworld — #2 is missing." */
  seriesMilestones: {
    /** {positions} is a list like "#1, #2 and #4". */
    have: 'You have {positions} of {name}',
    /** Used when the user owns many books of the series: "You have 6 Discworld books". */
    haveMany: { one: 'You have {count} {name} book', other: 'You have {count} {name} books' },
    /** {positions} is a list like "#3" or "#3 and #5". */
    missing: { one: '{positions} is missing.', other: '{positions} are missing.' },
    missingMany: { one: '{count} is missing, starting with #{first}.', other: '{count} are missing, starting with #{first}.' },
    /** The gap tip: the two sentences above joined. */
    gapTip: '{have} — {missing}',
    /** "All 9 Discworld books", or "You have the Solo book" for a series of one. */
    whole: { one: 'You have the {name} book', other: 'All {count} {name} books' },
    complete: 'Series complete! {whole}.',
  },
  /** Groups: the user's own little shelves ("Favourites"). */
  groups: {
    /** Names of the icons a group can wear (read as "Heart icon"). */
    icons: {
      heart: 'Heart',
      star: 'Star',
      bookmark: 'Bookmark',
      gift: 'Gift',
      moon: 'Moon',
      sun: 'Sun',
      pen: 'Pen',
      home: 'Home',
    },
    validation: {
      nameRequired: 'Give the group a name.',
      nameTooLong: 'Keep it under {max} characters.',
    },
    card: {
      /** A group card's name for a screen reader: "Favourites, 3 books". */
      label: '{name}, {books}',
    },
    screen: {
      title: 'Groups',
      intro: 'Your own little shelves, in any order you like.',
      newGroup: 'New group',
      created: 'Made “{name}”. Add some books to it from the Shelf.',
      emptyTitle: 'No groups yet',
      emptyMessage: 'Groups are like little shelves — try “Favourites”.',
      listLabel: 'Your groups',
    },
    detail: {
      notFoundTitle: 'Group not found',
      notFoundMessage: 'That group isn’t here any more. It may have been deleted.',
      /** {books} is the count, e.g. "2 books". */
      removed: 'Took {books} out of {name}',
      deleted: 'Deleted “{name}”. Its books are still on your shelf.',
      edit: 'Edit {name}',
      delete: 'Delete {name}',
      reorder: 'Reorder',
      reorderLabel: 'Reorder books',
      doneReorderingLabel: 'Done reordering',
      addBooks: 'Add books',
      select: 'Select',
      selectLabel: 'Select books',
      emptyTitle: 'No books here yet',
      emptyMessage: 'Pick some from your shelf and they’ll line up here in any order you like.',
      listLabel: 'Books in {name}',
      deleteTitle: 'Delete “{name}”?',
      deleteMessage: 'The group goes, but its books stay on your shelf.',
      deleteConfirm: 'Delete group',
    },
    editor: {
      editTitle: 'Edit group',
      newTitle: 'New group',
      subtitle: 'A little shelf of your own, like “Favourites” or “Signed copies”.',
      create: 'Create group',
      nameLabel: 'Name',
      /** Example group name shown in the empty name field. */
      namePlaceholder: 'Favourites',
      colour: 'Colour',
      icon: 'Icon',
      /** {icon} is an icon's name, e.g. "Heart". */
      iconLabel: '{icon} icon',
      /** The preview's name before one is typed. */
      previewName: 'Your group',
      saveFailed: 'Sorry, I couldn’t save that group. Please try again.',
    },
    picker: {
      empty: 'You have no groups yet. Make one and I’ll put the books in it.',
      newGroup: 'New group…',
      listLabel: 'Your groups',
      /** "Favourites, 3 books". */
      optionLabel: '{name}, {books}',
      alreadyAddedLabel: '{name}, already added',
      alreadyHere: 'Already here',
    },
    bookSection: {
      heading: 'Groups',
      added: 'Added “{title}” to {name}',
      addFailed: 'Sorry, I couldn’t add it to that group. Please try again.',
      openGroup: 'Open group {name}',
      none: 'Not in any of your groups yet.',
      add: 'Add to group',
      pickerTitle: 'Add “{title}” to a group',
      /** Stands in for a group's name when it can't be found: "Added “Mort” to the group". */
      fallbackName: 'the group',
    },
    reorder: {
      hint: 'Use the arrows to change the order.',
      listLabel: 'Books in this group',
      /** A row's name: "2. Mort". */
      rowLabel: '{index}. {title}',
      moved: '{title} moved to {position} of {total}',
      moveUp: 'Move {title} up',
      moveDown: 'Move {title} down',
    },
  },

  // Booky and onboarding
  /**
   * Booky, the bookmark who helps (P07): the character, its tips, the help
   * sheet and the first-run onboarding. Booky speaks in the first person
   * ("I’ll…"): warm, short, never blaming. Tips fit two short lines (about
   * 120 characters once filled in).
   */

  /** Booky's own controls and screen-reader words. */
  booky: {
    /** Booky's accessible name: "Booky the bookmark, smiling happily". */
    label: 'Booky the bookmark, {expression}',
    expressions: {
      happy: 'smiling happily',
      thinking: 'thinking',
      excited: 'looking excited',
      sleepy: 'looking sleepy',
      concerned: 'looking concerned',
    },
    bubble: {
      dismiss: "Dismiss Booky's tip",
    },
    overlay: {
      mute: 'Don’t show tips like this',
      /** What a screen reader hears for a tip with a title: "Hooray! Series complete! …". */
      announceWithTitle: '{title} {text}',
    },
    helpButton: {
      label: 'Help with this screen',
    },
    helpSheet: {
      /** The sheet's title when a screen has no help of its own (not normally seen). */
      title: 'Help',
      subtitle: 'A little help from Booky',
      close: 'Got it',
    },
    settings: {
      title: 'Booky',
      intro: 'How chatty your library helper is. Help buttons always work.',
      modesLabel: 'How chatty Booky is',
      modes: {
        helpful: { label: 'Helpful', hint: 'All my tips, when they’re useful.' },
        quiet: { label: 'Quiet', hint: 'Only problems, empty screens and help when you ask.' },
        off: { label: 'Off', hint: 'I stay out of sight. The help buttons still work.' },
      },
      /** A mode chip's accessible name: "Quiet: Only problems, …". */
      modeChip: '{label}: {hint}',
      resetTips: 'Reset tips',
      resetTipsHint: 'Shows tips you have seen or muted again',
      resetDone: 'Done: I’ll show my tips again when they’re useful.',
      tour: 'Show the welcome tour',
    },
  },
  /**
   * Booky's tips. `{placeholders}` are filled when the tip shows; `{books}`
   * and `{saved}` are already counted ("12 books"), `{them}` is "it" or "them".
   */
  tips: {
    actions: {
      moreHelp: 'More help',
      readCover: 'Read the cover',
      openLoans: 'Open loans',
      seeSeries: 'See the series',
      backUp: 'Back up',
      later: 'Later',
    },
    welcome: { text: 'Hi, I’m Booky! Let’s fill your shelf.' },
    shelfEmpty: { text: 'Your shelf is empty. Tap Scan to add your first book.' },
    scanFirstVisit: { text: 'Point me at the barcode on the back cover.' },
    scanIdle: { text: 'No barcode? Try reading the cover instead.' },
    lookupNone: { text: 'I couldn’t find that one. Let’s add it by hand — it only takes a minute.' },
    lookupNoneScan: { text: 'I couldn’t find that one. Let’s add it by hand — I’ll fill in what I know.' },
    lookupGaveUp: { text: 'I couldn’t find details for {books}. You can add {them} by hand.' },
    lookupArrived: { text: 'Good news — I found details for {books} you added offline.' },
    bookAdded: { text: 'Shelved! That’s {books}.' },
    bookAddedMilestone: { text: 'Shelved! That’s {books}. What a milestone!' },
    bookAddedBatch: { text: 'Shelved {saved}! That’s {books} in all.' },
    offlineQueued: { text: 'Saved — I’ll look this up when you’re back online.' },
    loanOverdue: {
      title: 'A gentle nudge',
      /** {when} is relative: "3 days ago", "yesterday". */
      text: '“{title}” was due back from {borrower} {when}.',
    },
    /** {have} and {missing} are whole sentences from the series screen: "You have #1 and #3 of Discworld", "#2 is missing." */
    seriesGap: { text: '{have} — {missing}' },
    seriesComplete: {
      title: 'Hooray!',
      /** {whole}: "All 13 A Series of Unfortunate Events books". */
      text: 'Series complete! {whole}.',
    },
    backupDue: {
      title: 'A little safety net',
      text: 'It’s been a while since your last backup — save one now?',
    },
    helpBooky: {
      title: 'Hi, I’m Booky!',
      text: 'I keep track of your books, who has borrowed them, and which series you’re part-way through.',
    },
    /** What Booky says when a screen's help button is pressed. */
    help: {
      shelf: 'This is your shelf. Search, sort or group your books, and tap one to see its details.',
      scan: 'Scan the barcode on the back cover, or switch to Cover and I’ll read the title instead.',
      loans: 'Books you’ve lent out live here. Tap “Mark returned” when one comes home.',
      groups: 'Groups are your own shelves: favourites, a book club, anything you like.',
      settings: 'Choose how chatty I am, and set up reminders for books you’ve lent.',
      book: 'Everything about this book. Rate it, lend it, add it to a group or edit its details from here.',
      editions: 'Pick the edition that matches your copy: check the cover, the publisher and the year.',
      series: 'The whole series in order. Dashed spines are the books you don’t have yet.',
    },
  },
  /** The help sheet ("More help"): a title and a few short sections per screen. */
  help: {
    /** Shared by the book's card and the editions screen. */
    edition: {
      heading: 'What is an edition?',
      body: 'The same book printed by a different publisher, in a different year or format. Each edition has its own ISBN.',
    },
    shelf: {
      title: 'Your shelf',
      finding: { heading: 'Finding a book', body: 'Type in the search box: a title, an author, a series or an ISBN all work.' },
      sorting: {
        heading: 'Sort, group and view',
        body: 'Sort by title, author or date added, group by genre, series, author or group, and switch between a list, covers and spines.',
      },
      selecting: {
        heading: 'Several at once',
        body: 'Tap Select (or press and hold a book) to pick several, then add them to a group or remove them. You can undo a removal for a few seconds.',
      },
    },
    scan: {
      title: 'Scanning a book',
      isbn: {
        heading: 'Where is the ISBN?',
        body: 'Turn the book over: the ISBN barcode is usually at the bottom of the back cover, starting 978 or 979. On a dust jacket, look on the back flap too.',
      },
      noBarcode: {
        heading: 'No barcode?',
        body: 'Older books often have none. Switch to Cover and photograph the front: I’ll read the title and author and show you the editions.',
      },
      pile: { heading: 'Scanning a pile', body: 'Turn on “Scan several” and every book waits in a tray, so you can check them all at the end.' },
    },
    loans: {
      title: 'Loans',
      lending: { heading: 'Lending a book', body: 'Open the book on your shelf and tap Lend. Pick who has it and when it’s due back.' },
      returned: { heading: 'When it comes back', body: 'Tap “Mark returned”. The loan moves to History, so you can see who borrowed what.' },
      reminders: {
        heading: 'Reminders',
        body: 'Turn on reminders in Settings and I’ll send a gentle note on the due date. I also mention overdue books when you open the app.',
      },
    },
    groups: {
      title: 'Groups',
      what: {
        heading: 'What is a group?',
        body: 'Your own little shelf: favourites, a book club, books to read next. A book can be in as many groups as you like.',
      },
      adding: { heading: 'Adding books', body: 'Open a group and tap “Add books”, or select books on the Shelf and choose “Add to group”.' },
      order: { heading: 'Changing the order', body: 'In a group, choose Reorder and move books up or down.' },
    },
    settings: {
      title: 'Settings',
      chatty: {
        heading: 'How chatty is Booky?',
        body: 'Helpful: all my tips. Quiet: only problems, empty screens and help when you ask. Off: I stay out of sight, but the help buttons still work.',
      },
      muted: { heading: 'Tips you’ve muted', body: '“Reset tips” brings back every tip you’ve seen or asked me not to show again.' },
    },
    book: {
      title: 'A book’s card',
      editing: { heading: 'Editing details', body: 'Tap the pencil to change anything: title, authors, genres, series or your own notes.' },
      rating: {
        heading: 'Your rating',
        body: 'Tap a star to rate the book, from 1 to 5. Tap the same star again, or Clear rating, to take it away. It’s only yours: looking up the book’s details never changes it.',
      },
      lending: { heading: 'Lending', body: 'Lend the book from here, and mark it returned when it comes home.' },
    },
    editions: {
      title: 'Choosing an edition',
      mine: {
        heading: 'Which one is mine?',
        body: 'Compare the cover, the publisher and the year with the book in your hands. The ISBN on the back is the surest match.',
      },
      unsure: { heading: 'Not sure?', body: 'Pick the closest one. You can change any detail later from the book’s card.' },
    },
    series: {
      title: 'Series',
      gaps: {
        heading: 'How do series gaps work?',
        body: 'I line the books up by their number. A dashed spine is a number you don’t have yet: tap it to add that book.',
      },
      total: {
        heading: 'Setting the total',
        body: 'Tell me how many books the series has, and I’ll show the ones missing at the end too, and cheer when it’s complete.',
      },
      tidying: { heading: 'Tidying up', body: 'Rename a series, or merge two that are really one, from the menu at the top.' },
    },
  },
  /** The first-run cards (`/onboarding`). */
  onboarding: {
    /** Read out as the user moves between cards. */
    page: 'Page {page} of {pages}',
    skip: 'Skip',
    skipLabel: 'Skip the introduction',
    next: 'Next',
    /** The Next button's accessible name: "Next: page 2 of 4". */
    nextLabel: 'Next: page {page} of {pages}',
    start: 'Let’s fill your shelf',
    explore: 'Look around first',
    welcome: {
      title: 'Welcome to MyShelf',
      /** {hello} is Booky's hello: "Hi, I’m Booky! Let’s fill your shelf." */
      text: '{hello} I’ll help you catalogue every book you own.',
    },
    scan: {
      title: 'Scan to add a book',
      text: 'Scan the barcode on the back, or let me read the cover. I’ll fill in the title, author and series.',
    },
    lend: {
      title: 'Lend without worry',
      text: 'Lend a book to a friend and I’ll keep track of who has it and when it’s due back.',
    },
    private: {
      title: 'Yours, and only yours',
      text: 'Everything stays on your phone. No account, no cloud, just your books.',
    },
  },
} as const;
