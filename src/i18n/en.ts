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
      exportHint: "If trying again doesn't help, save a copy of your library's database file and keep it somewhere safe. It holds your whole catalogue.",
      export: 'Save a copy of the library file',
      /** The Android share sheet's title. */
      shareDialogTitle: 'Save your library file',
      /** {fileName} is like "myshelf-library-2026-06-15.db". */
      shared: '{fileName} is ready. Keep it somewhere safe.',
      /** Web: the browser downloaded the file. */
      downloaded: 'Downloaded {fileName}.',
      noFile: "There's no library file on this device yet, so there's nothing to save.",
      cantShare: "This device can't share files, so the copy couldn't be saved.",
      exportFailed: "I couldn't save a copy of the library file.",
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

  // The Shelf, authors and genres
  /** The Shelf (home) screen: header, search summary, empty states, selecting and removing books. */
  shelf: {
    screen: {
      title: 'MyShelf',
      tagline: 'Your personal library, one shelf at a time.',
      /** The rubber-stamp count under the title. */
      count: { one: '{count} book catalogued', other: '{count} books catalogued' },
      activeFilters: 'Active filters',
      /** A filter chip's remove button; {label} is the chip's text, e.g. "Hardback". */
      removeFilter: 'Remove filter {label}',
      clearAllFilters: 'Clear all filters',
      addBook: 'Add book',
    },
    /** The live line under the toolbar; {count} is the whole shelf, {matched} how many match. */
    summary: {
      all: { one: 'Showing all {count} book', other: 'Showing all {count} books' },
      noneMatchQuery: 'No books match “{query}”',
      noneMatchFilters: 'No books match your filters',
      matchQuery: { one: '{matched} of {count} book match “{query}”', other: '{matched} of {count} books match “{query}”' },
      matchQueryAndFilters: { one: '{matched} of {count} book match “{query}” and filters', other: '{matched} of {count} books match “{query}” and filters' },
      matchFilters: { one: '{matched} of {count} book match your filters', other: '{matched} of {count} books match your filters' },
    },
    empty: {
      title: 'Your shelf is empty',
      message: "Scan a book's barcode or cover and I'll fill in the title, author, genre and series for you. Or type it in yourself.",
      scan: 'Scan a book',
      addManually: 'Add manually',
      askBooky: 'What can Booky do?',
    },
    noMatches: {
      title: 'No matches',
      query: 'Nothing on your shelf matches “{query}”. Check the spelling, or try an author, series or ISBN.',
      queryWithFilters: 'Nothing on your shelf matches “{query}” with these filters. Check the spelling, or try an author, series or ISBN.',
      clearSearch: 'Clear search',
      filtersTitle: 'Nothing matches these filters',
      filtersMessage: 'Try taking a filter or two away.',
      clearFilters: 'Clear filters',
    },
    selection: {
      /** The selection bar's button when picking books for a known group. */
      addTo: 'Add to {name}',
      addToGroup: 'Add to group',
      /** Stands in for a group's name in "Added 2 books to the group". */
      theGroup: 'the group',
      added: { one: 'Added {count} book to {group}', other: 'Added {count} books to {group}' },
      addedSomeAlready: {
        one: 'Added {count} book to {group}; the rest were already there',
        other: 'Added {count} books to {group}; the rest were already there',
      },
      /** Snackbar action: open the group. */
      view: 'View',
      addFailed: 'Sorry, I couldn’t add those books. Please try again.',
      removeFailed: 'Sorry, I couldn’t remove those books. Please try again.',
      pickerTitle: { one: 'Add {count} book to a group', other: 'Add {count} books to a group' },
    },
    removeDialog: {
      title: { one: 'Remove this book?', other: 'Remove {count} books?' },
      message: {
        one: 'Remove {count} book from your shelf? Their loan history goes too. You can undo this for a few seconds.',
        other: 'Remove {count} books from your shelf? Their loan history goes too. You can undo this for a few seconds.',
      },
      keep: 'Keep them',
    },
    removed: {
      message: { one: 'Removed {count} book from your shelf', other: 'Removed {count} books from your shelf' },
      restored: { one: '{count} book back on your shelf', other: '{count} books back on your shelf' },
      restoreFailed: 'Sorry, I couldn’t bring those books back.',
    },
    /** Books scanned offline, waiting for their details. */
    pending: {
      message: {
        one: '{count} book waiting for details. I’ll look it up when you’re back online.',
        other: '{count} books waiting for details. I’ll look them up when you’re back online.',
      },
      trying: 'Trying…',
      tryNow: 'Try now',
      /** Details found for books scanned offline, waiting for the user to choose the edition and save. */
      arrived: {
        one: 'I found details for {count} book you scanned offline.',
        other: 'I found details for {count} books you scanned offline.',
      },
      review: 'Review',
      /** "Review" as read out: which book it opens. */
      reviewLabel: 'Review the details found for ISBN {isbn}',
    },
  },
  /** The Shelf's filter sheet and the chips showing active filters. */
  filters: {
    sheet: {
      title: 'Filter your shelf',
      subtitle: 'Show only the books you want.',
      subtitleCount: { one: '{count} filter on', other: '{count} filters on' },
      clearAll: 'Clear all',
      genres: 'Genres',
      /** A genre chip: "Fantasy (12)". */
      genreChip: '{name} ({count})',
      onLoan: 'On loan',
      series: 'Series',
      format: 'Format',
      language: 'Language',
      published: 'Published',
      fromYear: 'From year',
      toYear: 'To year',
      yearHint: 'Your books span {from}–{to}.',
      /** The minimum-rating choice. */
      rating: 'Your rating',
      added: 'Added',
      addedRecently: { one: 'In the last {count} day', other: 'In the last {count} days' },
    },
    /** Book formats as the filters name them (not `other`: an object with `other` reads as a plural). */
    format: {
      hardcover: 'Hardback',
      paperback: 'Paperback',
      ebook: 'E-book',
      audiobook: 'Audiobook',
      otherFormat: 'Other format',
    },
    loan: { any: 'Any', onLoan: 'On loan', atHome: 'At home' },
    rating: { any: 'Any' },
    series: { any: 'Any', inSeries: 'In a series', standalone: 'Standalone' },
    /** Chips under the toolbar for the active filters. */
    chip: {
      /** A genre chip whose genre has gone. */
      genre: 'Genre',
      yearRange: '{from}–{to}',
      yearExact: 'Published {year}',
      yearFrom: 'From {year}',
      yearTo: 'Up to {year}',
      recentlyAdded: { one: 'Added in the last {count} day', other: 'Added in the last {count} days' },
    },
  },
  /** The Shelf toolbar (search, sort, group, view mode), sections and selection bar. */
  shelfView: {
    toolbar: {
      search: 'Search your shelf',
      searchPlaceholder: 'Search title, author or ISBN',
      clearSearch: 'Clear search',
      showBooksAs: 'Show books as',
      /** {summary} is a preset's name ("Library order"), one level ("Year published (Newest first)") or "Custom". */
      sortButton: 'Sort: {summary}',
      /** {summary} is the whole sort in words, e.g. "Genre, then Author". */
      sortButtonLabel: 'Sort by {summary}',
      sortHint: 'Opens the sort options',
      /** {grouping} is e.g. "Genre". */
      groupButton: 'Group: {grouping}',
      groupButtonLabel: 'Group by {grouping}',
      filter: 'Filter',
      filterCount: 'Filter ({count})',
      filterCountLabel: 'Filter, {count} on',
      select: 'Select',
      selectBooks: 'Select books',
      groupBy: 'Group by',
    },
    groupBy: {
      none: 'None',
      genre: 'Genre',
      series: 'Series',
      author: 'Author',
      group: 'My groups',
      rating: 'Rating',
    },
    viewMode: { list: 'List', covers: 'Covers', spines: 'Spines' },
    /** The section for books outside every bucket of a grouping. */
    ungrouped: {
      genre: 'No genre',
      series: 'Not in a series',
      author: 'No author',
      group: 'Not in a group',
      rating: 'Not rated',
    },
    section: {
      /** A section header: "Fantasy · 23". */
      heading: '{title} · {count}',
      open: 'Open {title}',
    },
    browse: {
      heading: 'Browse',
      genres: 'Genres',
      genresLabel: 'Browse genres',
      series: 'Series',
      seriesLabel: 'Browse series',
      authors: 'Authors',
      authorsLabel: 'Browse authors',
      groups: 'Groups',
      groupsLabel: 'Browse groups',
    },
    selectionBar: {
      label: 'Selected books',
      stop: 'Stop selecting',
      /** The count line before any book is picked. */
      none: 'Select books',
      count: { one: '{count} book selected', other: '{count} books selected' },
      addToGroup: 'Add to group…',
      removeFromGroup: 'Remove from group',
    },
  },
  /** The Shelf's multi-level sort (Phase 11): the Sort sheet, its keys, presets and the summary. */
  sort: {
    sheet: {
      title: 'Sort your shelf',
      done: 'Done',
      presets: 'Presets',
      shuffleAgain: 'Shuffle again',
      yourPresets: 'Your presets',
      /** A saved preset chip's spoken name: "Doorstops: Page count (Longest first)". */
      savedPresetLabel: '{name}: {summary}',
      renameField: 'New name for {name}',
      cancel: 'Cancel',
      rename: 'Rename',
      renameLabel: 'Rename {name}',
      deleteLabel: 'Delete {name}',
      yourSort: 'Your sort',
      /** {grouping} is lower case ("genre"); {key} is the first level ("Genre"). */
      groupNote: 'Grouped by {grouping}: {key} orders the sections, so inside them the next level decides.',
      levels: 'Sort levels',
      /** The first level's name. */
      levelFirst: 'Sort by',
      /** Every later level's name. */
      levelNext: 'Then by',
      /** "2. Then by" */
      levelHeading: '{number}. {level}',
      /** A level as a screen reader hears it: "Level 2: Then by Author, A to Z". */
      levelName: 'Level {number}: {level} {key}, {direction}',
      keyButton: '{level}: {key}. Change',
      directionButton: '{key} order: {direction}. Reverse',
      moveUp: 'Move {key} up',
      moveDown: 'Move {key} down',
      remove: 'Remove {key}',
      chooseKey: '{level}: choose a key',
      tiebreak: 'Books still tied after the last level go by title.',
      addLevel: 'Add a level',
      addLevelFull: 'Add a level (at most {max})',
      savePreset: 'Save as preset',
      presetName: 'Preset name',
      presetPlaceholder: 'e.g. Reading pile',
      savePresetButton: 'Save preset',
    },
    /** What the sheet's polite live region says after a change. */
    announce: {
      moved: '{key} moved to level {number} of {total}',
      removed: 'Removed {key}',
      added: 'Added level {number}: {key}. Choose what to sort by.',
      chosen: '{level} {key}, {direction}',
      flipped: '{key}: {direction}',
      saved: 'Saved “{name}”',
      renamed: 'Renamed to “{name}”',
      deleted: 'Deleted “{name}”',
      sortedBy: 'Sorted by {name}',
      shuffled: 'Shuffled',
      shuffledAgain: 'Shuffled again',
    },
    nameProblem: {
      empty: 'Give it a name.',
      tooLong: { one: 'Keep it under {count} character.', other: 'Keep it under {count} characters.' },
      taken: 'You already have a preset with that name.',
      full: 'That’s as many presets as I can keep. Delete one first.',
    },
    summary: {
      /** The line under the Shelf's toolbar; {summary} is e.g. "Genre, then Author, then Series". */
      shelf: 'Sorted by {summary}',
      /** Between levels in a summary: "Genre, then Author". */
      separator: ', then ',
      /** A level whose direction is not the key's usual one: "Date added (Oldest first)". */
      withDirection: '{key} ({direction})',
      /** The first level when it is also the grouping. */
      asSections: '{key} (as sections)',
      asSectionsWithDirection: '{key} (as sections, {direction})',
      /** The sort button when the sort is several levels and no preset. */
      custom: 'Custom',
    },
    keys: {
      title: { label: 'Title', hint: 'Ignoring a leading The, A or An' },
      author: { label: 'Author', hint: 'First author’s surname' },
      series: { label: 'Series', hint: 'Series name; books in no series last' },
      seriesPosition: { label: 'Number in series', hint: 'Book 1, 2, 2.5, 3…' },
      genre: { label: 'Genre', hint: 'A book in several genres files under the first alphabetically' },
      year: { label: 'Year published', hint: 'Publication year' },
      added: { label: 'Date added', hint: 'When it joined your shelf' },
      updated: { label: 'Last edited', hint: 'When its details last changed' },
      pages: { label: 'Page count', hint: 'Number of pages' },
      publisher: { label: 'Publisher', hint: 'Publisher’s name' },
      language: { label: 'Language', hint: 'Language name, in English' },
      format: { label: 'Format', hint: 'Hardback, paperback, e-book, audiobook' },
      onLoan: { label: 'On loan', hint: 'Books lent out, or books at home' },
      borrower: { label: 'Borrower', hint: 'Who has it; books at home last' },
      group: { label: 'Group', hint: 'Your groups; a book in several files under the first alphabetically' },
      titleLength: { label: 'Title length', hint: 'Number of letters in the title' },
      colour: { label: 'Spine colour', hint: 'A rainbow of the colours the app gives each spine (not the cover photo)' },
      callNumber: { label: 'Call number', hint: 'Class, author and year, as on the book’s card' },
      rating: { label: 'Rating', hint: 'Your stars; unrated books last' },
      shuffle: { label: 'Surprise me', hint: 'A shuffle that stays put until you shuffle again' },
    },
    direction: {
      aToZ: 'A to Z',
      zToA: 'Z to A',
      firstToLast: 'First to last',
      lastToFirst: 'Last to first',
      oldestFirst: 'Oldest first',
      newestFirst: 'Newest first',
      longestAgoFirst: 'Longest ago first',
      mostRecentFirst: 'Most recent first',
      shortestFirst: 'Shortest first',
      longestFirst: 'Longest first',
      hardbackFirst: 'Hardback first',
      audiobookFirst: 'Audiobook first',
      onLoanFirst: 'On loan first',
      atHomeFirst: 'At home first',
      redToViolet: 'Red to violet',
      violetToRed: 'Violet to red',
      highestFirst: 'Highest first',
      lowestFirst: 'Lowest first',
      shuffled: 'Shuffled',
    },
    presets: {
      library: 'Library order',
      seriesOrder: 'Series reading order',
      callNumber: 'Call number',
      newest: 'Newest additions',
      titleAZ: 'A–Z by title',
      byAuthor: 'By author',
      rainbow: 'Rainbow',
      surprise: 'Surprise me',
    },
  },
  /** A book in a list: rows, cover cells and spines. */
  bookList: {
    /**
     * What a screen reader says for a book, built up in steps:
     * "Mort" → "Mort, by Terry Pratchett" → "…, 1987" → "…, on loan to Sam".
     */
    row: {
      withAuthors: '{title}, by {authors}',
      withYear: '{label}, {year}',
      withLoan: '{label}, {loan}',
      /** {rated} is "rated 4 out of 5". */
      withRating: '{label}, {rated}',
    },
    /** A name and its book count: "Fantasy, 23 books", "Terry Pratchett, 1 book". */
    nameAndCount: { one: '{name}, {count} book', other: '{name}, {count} books' },
    coverOf: 'Cover of {title}',
    /** The badge on a cover that is out on loan. */
    onLoan: 'On loan',
    /** Written up a gap in a series' spines (lower case, vertical). */
    missing: 'missing',
  },
  /** The authors index and an author's page. */
  authors: {
    index: {
      title: 'Authors',
      summary: { one: '{count} author, filed by surname.', other: '{count} authors, filed by surname.' },
      emptyTitle: 'No authors yet',
      emptyMessage: 'Authors appear here as you add books.',
      /** The "#" index letter. */
      symbols: 'Numbers and symbols',
      letter: 'Letter {letter}',
      listSymbols: 'Authors under numbers and symbols',
      list: 'Authors under {letter}',
    },
    detail: {
      /** Stamp above the author's name. */
      stamp: 'Author',
      filedUnder: 'Filed under {name}',
      onShelf: { one: '{count} book on your shelf', other: '{count} books on your shelf' },
      noBooks: 'No books by this author yet.',
      edit: 'Edit {name}',
      merge: 'Merge {name} with another author',
      notFoundTitle: 'Author not found',
      notFoundMessage: 'That author isn’t in your catalogue any more. They may have been merged with another.',
      merged: 'Merged into {name}',
      mergeFailed: 'Sorry, I couldn’t merge those authors. Please try again.',
      confirmTitle: 'Merge into {name}?',
      confirmTitleFallback: 'Merge?',
      confirmMessage: {
        one: '{name}’s {count} book will be credited to {target}, and “{name}” goes away.',
        other: '{name}’s {count} books will be credited to {target}, and “{name}” goes away.',
      },
    },
    edit: {
      title: 'Edit author',
      name: 'Name',
      sortName: 'Filed under',
      sortNameHelp: 'How the author is sorted, surname first, e.g. “Pratchett, Terry”.',
      nameRequired: 'An author needs a name.',
    },
    mergeSheet: {
      title: 'Merge “{name}” into…',
      subtitle: 'For duplicates like “J.R.R. Tolkien” and “J. R. R. Tolkien”: the books move to the author you choose.',
      find: 'Find an author',
      list: 'Authors to merge into',
      none: 'No other author matches.',
    },
    /** Section titles on an author's page. */
    shelves: {
      series: 'Series',
      /** Books outside any series, after the series. */
      standalone: 'Standalone',
      /** The only section, when none of the books is in a series. */
      books: 'Books',
    },
  },
  /** The genres index and a genre's page. */
  genres: {
    index: {
      title: 'Genres',
      intro: 'Tidy your genres: rename them, merge near-duplicates, or open one to see its books.',
      emptyTitle: 'No genres yet',
      emptyMessage: 'Genres appear here as you add books. Lookups fill them in for you.',
      list: 'Genres',
      rename: 'Rename {name}',
      merge: 'Merge {name} into another genre',
      delete: 'Delete {name}',
    },
    rename: {
      title: 'Rename “{name}”',
      titleFallback: 'Rename',
      field: 'Genre name',
      required: 'A genre needs a name.',
      failed: 'Sorry, I couldn’t rename it. Please try again.',
      done: 'Renamed to “{name}”',
    },
    merge: {
      title: 'Merge “{name}” into…',
      titleFallback: 'Merge into…',
      subtitle: 'Its books move to the genre you choose, and it goes away.',
      list: 'Genres to merge into',
      confirmTitle: 'Merge into “{name}”?',
      confirmTitleFallback: 'Merge?',
      confirmMessage: {
        one: 'Merge “{source}” into it? Its {count} book will be tagged “{target}”.',
        other: 'Merge “{source}” into it? Its {count} books will be tagged “{target}”.',
      },
      /** After renaming a genre onto a name that is already taken. */
      confirmMessageTaken: {
        one: 'There’s already a genre called “{target}”. Merge “{source}” into it? Its {count} book will be tagged “{target}”.',
        other: 'There’s already a genre called “{target}”. Merge “{source}” into it? Its {count} books will be tagged “{target}”.',
      },
      done: { one: 'Merged into “{name}”: {count} book', other: 'Merged into “{name}”: {count} books' },
      stale: 'Those genres have already changed.',
      failed: 'Sorry, I couldn’t merge those genres. Please try again.',
    },
    delete: {
      title: 'Delete “{name}”?',
      titleFallback: 'Delete?',
      message: {
        one: 'The {count} book stay on your shelf; they just lose this genre.',
        other: 'The {count} books stay on your shelf; they just lose this genre.',
      },
      done: 'Deleted “{name}”',
      failed: 'Sorry, I couldn’t delete that genre. Please try again.',
    },
    detail: {
      /** Stamp above the genre's name. */
      stamp: 'Genre',
      list: 'Books in {name}',
      none: 'No books have this genre yet.',
      notFoundTitle: 'Genre not found',
      notFoundMessage: 'That genre isn’t in your catalogue any more. It may have been merged or deleted.',
    },
  },

  /** The reader's own star rating of a book (P10). */
  rating: {
    stars: { one: '{count} star', other: '{count} stars' },
    /** The rating control's value: "4 out of 5 stars". */
    valueText: '{rating} out of {max} stars',
    notRated: 'Not rated',
    /** Part of a book's spoken name: "Mort, by Terry Pratchett, 1987, rated 4 out of 5". */
    rated: 'rated {rating} out of {max}',
    /** Announced after rating a book. */
    announce: { one: 'Rated {count} star', other: 'Rated {count} stars' },
    cleared: 'Rating cleared',
    /** A minimum-rating filter: "4 stars and up". */
    andUp: { one: '{count} star and up', other: '{count} stars and up' },
    /** The star control (a slider for screen readers). */
    control: {
      label: 'Rating',
      clear: 'Clear rating',
      /** TalkBack's swipe up / down actions. */
      more: 'One more star',
      fewer: 'One star fewer',
    },
    /** Under the stars on a book's page, before it is rated. */
    tapToRate: 'Tap a star to rate this book.',
    saveFailed: 'Sorry, I couldn’t save that rating. Please try again.',
  },

  // Books: detail, form and lookups
  /** Words about a book shared by its card, form and detail page. */
  book: {
    /** Shown while a book's details load. */
    loading: 'Fetching the card from the drawer…',
    formats: {
      hardcover: 'Hardback',
      paperback: 'Paperback',
      ebook: 'Ebook',
      audiobook: 'Audiobook',
      /** Any other format. (Not `other`: an object with an `other` key reads as a plural.) */
      otherFormat: 'Other',
    },
    /** A contributor's role, as a chip in the form's author details. */
    roles: {
      author: 'Author',
      illustrator: 'Illustrator',
      translator: 'Translator',
      editor: 'Editor',
    },
    /** The detail page's catalogue card. */
    header: {
      /** A non-author credit: "Quentin Blake (illustrator)". */
      credit: '{name} ({role})',
      /** The role in a credit line, lower case mid-sentence. */
      creditRoles: {
        author: 'author',
        illustrator: 'illustrator',
        translator: 'translator',
        editor: 'editor',
      },
      isbn13: 'ISBN-13',
      isbn10: 'ISBN-10',
    },
    /** The book's place in its series, on the detail page. */
    seriesSection: {
      notNumbered: 'Not numbered in the series',
      /** "Book 5 of 9". */
      placeOf: 'Book {position} of {total}',
      /** "Book 5", when the series length is unknown. */
      place: 'Book {position}',
      /** A gap in the series next to this book: "#3 isn’t on your shelf yet". */
      missing: '#{position} isn’t on your shelf yet',
      /** A neighbouring book: "The Light Fantastic (#2)". */
      neighbour: '{title} (#{position})',
      /** Label before the previous book; the book's title follows. */
      previous: 'Previous: ',
      /** Label before the next book; the book's title follows. */
      next: 'Next: ',
      previousLink: 'Previous in the series: {book}',
      nextLink: 'Next in the series: {book}',
      seriesLink: '{name}: see the whole series',
      seeSeries: 'See series',
    },
  },
  /** The add/edit form. */
  bookForm: {
    ratingHelp: 'Just for you. Looking up the book’s details never changes it.',
    editHeading: 'Edit book',
    addIntro: 'Type up a new catalogue card. Only the title is required.',
    editIntro: 'Change anything on the card, then save.',
    /** After a failed save: the fields to check. */
    errorSummary: { one: 'Please check the {fields} field.', other: 'Please check {count} fields: {fields}.' },
    sections: {
      theBook: 'The book',
      summaryAndNotes: 'Summary and notes',
    },
    /** Field names the form uses that the change lists don't. */
    fields: {
      /** The star rating's section and field name. */
      rating: 'Your rating',
      titleRequired: 'Title (required)',
      isbn: 'ISBN',
      seriesPosition: 'Number in series',
      notes: 'Notes',
    },
    isbnHelp: '10 or 13 digits, usually on the back cover above the barcode.',
    editionPlaceholder: 'e.g. First edition',
    notesHelp: 'Just for you: where you got it, who signed it, what you thought.',
    saveNew: 'Save to shelf',
    saveChanges: 'Save changes',
    /** The small "Add" button next to the author and genre boxes. */
    add: 'Add',
    cover: {
      /** Title on the generated cover before a title is typed. */
      untitled: 'New book',
      hasCover: 'This cover goes on the catalogue card.',
      noCover: 'No cover yet: your shelf shows a cloth binding until you add one.',
      choosePhoto: 'Choose a photo',
      takePhoto: 'Take a photo',
      findOnline: 'Find a cover online',
      remove: 'Remove cover',
    },
    authors: {
      listOne: 'Author',
      listMany: 'Authors, in credited order',
      /** How an author sorts: "Filed as Pratchett, Terry". */
      filedAs: 'Filed as {name}',
      moveUp: 'Move {name} up',
      moveDown: 'Move {name} down',
      details: 'Details for {name}',
      remove: 'Remove {name}',
      role: 'Role',
      roleOf: 'Role of {name}',
      filedAsLabel: 'Filed as',
      filedAsHelp: 'How the name sorts on the shelf. Leave empty to use the suggestion.',
      inputFirst: 'Author',
      inputMore: 'Add another author',
      placeholder: 'e.g. Terry Pratchett',
      addTyped: 'Add {name} as an author',
      addEmpty: 'Add author',
      suggestions: 'Author suggestions',
      addSuggestion: 'Add {name}, already in your library',
      /** Beside a suggested author who is already in the catalogue. */
      inLibrary: 'in your library',
    },
    genres: {
      chosen: 'Chosen genres',
      remove: 'Remove genre {name}',
      inputFirst: 'Genre',
      inputMore: 'Add another genre',
      placeholder: 'e.g. Fantasy',
      addTyped: 'Add genre {name}',
      addEmpty: 'Add genre',
      matching: 'Matching genres',
      suggestions: 'Suggestions',
    },
    series: {
      /** A chip with the series a lookup suggested: "Suggested: Discworld #5". */
      suggested: 'Suggested: {series}',
      useSuggested: 'Use the suggested series, {series}',
      namePlaceholder: 'Search or add, e.g. Discworld',
      /** The book's number in the series. */
      number: 'Number',
      numberPlaceholder: 'e.g. 5',
      numberHelp: '3, 2.5 or III',
      savesAs: 'Saves as #{position}',
      numberInvalid: 'Use a number like 3, 2.5 or III',
      /** "In your library · 4 books". */
      inLibrary: 'In your library · {books}',
      newSeries: 'A new series: it’s added when you save.',
      list: 'Series in your library',
      /** "Discworld, 4 books in your library". */
      option: '{name}, {books} in your library',
      createLabel: 'Start a new series called {name}',
      create: 'New series “{name}”',
      clear: 'Not part of a series',
    },
    /** The "Find it online" panel at the top of the add form. */
    lookup: {
      chosen: 'Filled in from {source}. Check the card below, change anything you like, then save.',
      searchAgain: 'Look up another book',
      heading: 'Find it online',
      intro: 'Look the book up and I’ll fill in the card for you, cover and all.',
      isbnPlaceholder: 'e.g. 978-0-552-16659-1',
      lookUp: 'Look up',
      searchLabel: 'Search online',
      searchPlaceholder: 'Title and author, e.g. colour of magic pratchett',
      search: 'Search',
      lookingUp: 'Looking up {isbn}…',
      searching: 'Searching the catalogues for “{query}”…',
      noIsbnMatch: 'No match for that ISBN',
      noMatches: 'No matches',
      addByHand: 'Add it by hand',
      results: { one: '{count} match. Choose yours to fill in the card.', other: '{count} matches. Choose yours to fill in the card.' },
    },
    screen: {
      cameraDenied: 'I need the camera to photograph a cover. You can allow it in your phone’s settings.',
      photosFailed: 'Sorry, I couldn’t open the photos. Please try again.',
      savedNew: 'Saved “{title}” to your shelf',
      savedChanges: 'Saved your changes',
      discardTitle: 'Discard your changes?',
      discardNew: 'This book hasn’t been saved to your shelf yet.',
      discardEdit: 'Your edits to this card haven’t been saved.',
      keepEditing: 'Keep editing',
      discard: 'Discard',
    },
  },
  /** A book's page. */
  bookDetail: {
    edit: 'Edit {title}',
    moreActions: 'More actions',
    moreActionsFor: 'More actions for {title}',
    refresh: 'Refresh details',
    delete: 'Delete book',
    deleteFailed: 'Sorry, I couldn’t remove that book. Please try again.',
    confirmDelete: {
      title: 'Remove this book?',
      message: 'Remove “{title}” from your shelf? Loan history for it will be removed too.',
      keep: 'Keep it',
      onLoan: 'It’s on loan to {name} right now, and that loan will be forgotten too.',
    },
    /** The snackbar after a delete, with Undo. */
    undoDelete: {
      removed: 'Removed “{title}” from your shelf',
      restored: '“{title}” is back on your shelf',
      restoreFailed: 'Sorry, I couldn’t bring “{title}” back.',
    },
    sections: {
      notes: 'Notes',
      loan: 'Loan',
    },
    missing: {
      title: 'Book not found',
      message: "I looked on every shelf, but that book isn't in your catalogue. It may have been removed.",
      back: 'Back to shelf',
    },
    summary: {
      readMore: 'Read more',
      showLess: 'Show less',
      readMoreLabel: 'Read more of the summary',
      showLessLabel: 'Show less of the summary',
    },
    /** "Is this Discworld #5?": checking a guessed series. */
    seriesConfirm: {
      label: 'Check the series',
      question: 'Is this {series}?',
      explanation: 'I spotted the series in the book’s details. Is it right?',
      save: 'Save series',
      yes: 'Yes',
      yesLabel: 'Yes, it’s {series}',
      change: 'Change',
      no: 'Not a series',
      nameMissing: 'Type the series name, or choose “Not a series”.',
    },
  },
  /** A lookup result (an edition or a work) as a card. */
  candidate: {
    facts: {
      firstPublished: 'First published {year}',
      editions: { one: '{count} edition', other: '{count} editions' },
      pages: { one: '{count} page', other: '{count} pages' },
      /** In the edition picker, for an edition whose catalogue record gives no language. */
      languageUnknown: 'Language not listed',
    },
    /** What a screen reader says after the title. */
    label: {
      by: 'by {names}',
      isbn: 'ISBN {isbn}',
      /** The catalogue it came from: "from Open Library". */
      source: 'from {source}',
    },
    showMore: 'Show {count} more',
  },
  /** Language names, by ISO 639-1 code: the book form's picker and the book's page. */
  languages: {
    names: {
      af: 'Afrikaans',
      sq: 'Albanian',
      ar: 'Arabic',
      hy: 'Armenian',
      eu: 'Basque',
      be: 'Belarusian',
      bn: 'Bengali',
      bs: 'Bosnian',
      br: 'Breton',
      bg: 'Bulgarian',
      ca: 'Catalan',
      zh: 'Chinese',
      hr: 'Croatian',
      cs: 'Czech',
      da: 'Danish',
      nl: 'Dutch',
      en: 'English',
      eo: 'Esperanto',
      et: 'Estonian',
      fo: 'Faroese',
      fi: 'Finnish',
      fr: 'French',
      fy: 'Frisian',
      gl: 'Galician',
      ka: 'Georgian',
      de: 'German',
      el: 'Greek',
      gu: 'Gujarati',
      he: 'Hebrew',
      hi: 'Hindi',
      hu: 'Hungarian',
      is: 'Icelandic',
      id: 'Indonesian',
      ga: 'Irish',
      it: 'Italian',
      ja: 'Japanese',
      kk: 'Kazakh',
      ko: 'Korean',
      ku: 'Kurdish',
      la: 'Latin',
      lv: 'Latvian',
      lt: 'Lithuanian',
      lb: 'Luxembourgish',
      mk: 'Macedonian',
      ms: 'Malay',
      ml: 'Malayalam',
      mt: 'Maltese',
      mr: 'Marathi',
      mn: 'Mongolian',
      mi: 'Māori',
      ne: 'Nepali',
      no: 'Norwegian',
      nb: 'Norwegian Bokmål',
      nn: 'Norwegian Nynorsk',
      fa: 'Persian',
      pl: 'Polish',
      pt: 'Portuguese',
      pa: 'Punjabi',
      ro: 'Romanian',
      ru: 'Russian',
      sa: 'Sanskrit',
      gd: 'Scottish Gaelic',
      sr: 'Serbian',
      sk: 'Slovak',
      sl: 'Slovenian',
      so: 'Somali',
      es: 'Spanish',
      sw: 'Swahili',
      sv: 'Swedish',
      tl: 'Tagalog',
      ta: 'Tamil',
      te: 'Telugu',
      th: 'Thai',
      bo: 'Tibetan',
      tr: 'Turkish',
      uk: 'Ukrainian',
      ur: 'Urdu',
      uz: 'Uzbek',
      vi: 'Vietnamese',
      cy: 'Welsh',
      yi: 'Yiddish',
      zu: 'Zulu',
    },
  },
  /** The book form's checks, and the changes "Refresh details" offers. */
  draft: {
    /** Shown under a form field. */
    errors: {
      titleMissing: 'Every book needs a title.',
      titleTooLong: 'That title is a little long — keep it under {max} characters.',
      isbnCharacters: 'An ISBN only has digits (and maybe an X at the end).',
      isbnChecksum: 'That ISBN doesn’t look right — check the last digit.',
      /** {count} is how many digits were typed. */
      isbnLength: 'An ISBN has 10 or 13 digits — this one has {count}.',
      yearFormat: 'Enter the year as four digits, like 1987.',
      yearRange: 'Enter a year between {earliest} and {latest}.',
      pagesFormat: 'Pages should be a whole number, like 320.',
      pagesTooMany: 'That’s a lot of pages — check the number.',
      language: 'Pick a language from the list.',
      format: 'Pick a format from the list.',
      seriesPosition: 'Use a number like 3, or 2.5 for a novella between books.',
      seriesNameMissing: 'Add the series name to go with its number.',
      authorTooLong: 'One of those names is very long — check it.',
    },
    /** A proposed change in "Refresh details". */
    change: {
      /** What a cover change adds. */
      realCover: 'The real cover',
      /** Spoken: "Summary: add A wizard's tale". */
      addLabel: '{field}: add {value}',
      /** Spoken: "Pages: 223 → 214". */
      changeLabel: '{field}: {from} → {to}',
      add: '{field}: add',
      update: '{field}: update',
      now: 'Now: {value}',
      new: 'New: {value}',
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
      hint: 'Hold a book and drag it to its place, or use the arrows.',
      listLabel: 'Books in this group',
      /** A row's name: "2. Mort". */
      rowLabel: '{index}. {title}',
      moved: '{title} moved to {position} of {total}',
      moveUp: 'Move {title} up',
      moveDown: 'Move {title} down',
    },
  },

  // Settings
  /** The Settings tab, its rows and the shared settings controls (P08-01). */
  settings: {
    screen: {
      title: 'Settings',
      intro: 'Everything here stays on this phone. There are no accounts and nothing to sign in to.',
    },
    library: {
      title: 'Library',
      intro: 'How your shelf looks when you open it, and how long loans last.',
      preferencesLabel: 'Shelf and lending',
      /** Under "Shelf and lending": the shelf's sort order, then the default loan length ("Title, A to Z · lend for 28 days (4 weeks)"). */
      preferencesDescription: '{sort} · lend for {loanLength}',
    },
    lookups: {
      title: 'Lookups',
      intro: 'Where MyShelf finds book details and covers. Only ISBNs and search words are sent.',
      googleBooksLabel: 'Ask Google Books too',
      googleBooksOff: 'Only Open Library is asked for book details.',
      /** This build was made with its own Google Books API key. */
      googleBooksKeyed: 'Asked alongside Open Library, with this build’s own Google Books access.',
      googleBooksUnkeyed: 'Asked alongside Open Library. Without its own access key, Google Books can be slow at busy times.',
      coversLabel: 'Fetch covers on mobile data',
      coversAnyConnection: 'Missing covers are fetched on any connection.',
      coversWifiOnly: 'Missing covers wait for Wi-Fi.',
      pendingLabel: 'Pending lookups',
      pendingDescription: 'ISBNs waiting for the internet',
      /** How many ISBNs are queued, shown on the right of the row. */
      pendingWaiting: { one: '{count} waiting', other: '{count} waiting' },
      pendingNone: 'None',
    },
    lending: {
      title: 'Lending',
      remindersUnsupported: 'Reminders work in the Android app.',
      remindersDenied: 'Notifications are turned off for MyShelf. You can allow them in your phone’s settings, then try again.',
      borrowersLabel: 'Borrowers',
      borrowersDescription: 'Rename or remove the people you lend to',
      borrowersCount: { one: '{count} person', other: '{count} people' },
    },
    data: {
      title: 'Backup & data',
      intro: 'Your library lives only on this phone. A backup file keeps it safe.',
      backUpLabel: 'Back up your library',
      backUpDescription: 'Save a file you can restore on any phone',
      /** When the last backup was made ("Last: 3 days ago", "Last: Never"). */
      lastBackup: 'Last: {when}',
      restoreLabel: 'Restore from a backup',
      restoreDescription: 'Bring back a library from a backup file',
      exportCsvLabel: 'Export as a spreadsheet',
      exportCsvDescription: 'A CSV file of your books for Excel or Sheets',
      importCsvLabel: 'Import books from a spreadsheet',
      importCsvDescription: 'A CSV file, including a Goodreads export',
      eraseLabel: 'Erase library',
      eraseDescription: 'Remove every book from this phone',
    },
    about: {
      title: 'About',
      label: 'About MyShelf',
      description: 'Credits, licences and privacy',
      version: 'Version {version}',
    },
    page: {
      /** The back button on every screen under Settings. */
      back: 'Back to Settings',
    },
    controls: {
      /** A radio card's spoken name: its label, then its sentence ("Light. Warm paper and ink, always."). */
      choice: '{label}. {description}',
      /** A link that leaves the app, as a screen reader says it. */
      externalLink: '{label} (opens in your browser)',
      /** Between the parts a settings row speaks: its label, value and explanation. */
      spokenSeparator: ', ',
    },
  },
  /** Settings → Shelf and lending (P08-07). */
  preferences: {
    title: 'Shelf and lending',
    intro: 'Changes are saved straight away.',
    sort: {
      label: 'Sort the shelf by',
      titleDesc: 'Title, Z to A',
      authorAsc: 'Author, A to Z',
      authorDesc: 'Author, Z to A',
      yearAsc: 'Year, oldest first',
      yearDesc: 'Year, newest first',
      addedAsc: 'Oldest additions first',
      ratingDesc: 'Rating, highest first',
      ratingAsc: 'Rating, lowest first',
      /** The Shelf's sort when it is none of the choices; {summary} is e.g. "Publisher, then Year published". */
      custom: 'Custom: {summary}',
      helper: 'Presets and your saved sorts. Build your own from the Shelf’s Sort button.',
    },
    groupBy: {
      label: 'Split the shelf into sections by',
      none: 'No sections',
      genre: 'Genre',
      series: 'Series',
      author: 'Author',
      /** The user's own named groups of books. */
      group: 'My groups',
      rating: 'Rating',
    },
    viewMode: {
      label: 'Show books as',
      list: 'List',
      covers: 'Covers',
      spines: 'Spines',
    },
    loanLength: {
      label: 'Lend books for',
      helper: 'The due date a new loan starts with. You can still change it when lending.',
      /** A loan length in whole weeks: {days} is the number of days, {count} the number of weeks ("14 days (2 weeks)"). */
      weeks: { one: '{days} days ({count} week)', other: '{days} days ({count} weeks)' },
      /** A loan length that is not whole weeks ("10 days"). */
      days: { one: '{count} day', other: '{count} days' },
      custom: 'Custom…',
      /** The "Custom" option while a length that is not offered is in use ("10 days (custom)"). */
      customValue: { one: '{count} day (custom)', other: '{count} days (custom)' },
      customLabel: 'Days until a loan is due',
      customError: 'Enter a number of days from 1 to {max}.',
      customSave: 'Use this length',
    },
    dateFormat: {
      label: 'Write dates as',
      /** {date} is today, written in the chosen format. */
      example: 'Today is written {date}.',
    },
    appearance: {
      heading: 'Appearance',
      label: 'Colours',
      systemLabel: 'Same as my phone',
      systemDescription: 'Light by day, dark by night, whenever your phone switches.',
      lightLabel: 'Light',
      lightDescription: 'Warm paper and ink, always.',
      darkLabel: 'Dark',
      darkDescription: 'The night library: lamp-lit colours on a dark shelf, always.',
    },
  },
  /** Settings → About MyShelf (P08-08). */
  about: {
    title: 'About MyShelf',
    /** "Version 1.0.0 · Android build 3". */
    version: 'Version {version} · {build}',
    tagline: 'A cosy catalogue for the books you own, and a note of who borrowed which.',
    build: {
      android: 'Android build {code}',
      androidUnnumbered: 'Android build',
      web: 'Web build',
      /** {platform} is the operating system's id, e.g. "ios". */
      otherPlatform: '{platform} build',
    },
    attribution: {
      eyebrow: 'With thanks',
      title: 'Book details and covers',
      data: 'Book data from Open Library (Internet Archive) and Google Books.',
      covers:
        'Cover images come from the same two places: Open Library’s covers and Google Books thumbnails. Each cover belongs to its publisher or artist; MyShelf only shows it next to your copy.',
      openLibrary: 'Open Library',
      googleBooks: 'Google Books',
    },
    licence: {
      eyebrow: 'Licence',
      title: 'Free and open source',
      body: 'MyShelf is free software under the MIT licence. Anyone can read, use and improve the code.',
      repoLink: 'MyShelf on GitHub',
    },
    privacy: {
      eyebrow: 'Privacy',
      title: 'Your privacy',
      body: 'Your library stays on this phone. There are no accounts, analytics or ads. To find details and covers, MyShelf sends only ISBNs and the words you search for to Open Library and Google Books — never your notes or who borrowed what.',
      link: 'Read the privacy notes',
    },
    licences: {
      heading: 'Open-source licences',
      /** {summary} lists licences by how many packages use them ("518 MIT, 30 ISC"). */
      intro: { one: 'MyShelf is built with {count} open-source package: {summary}.', other: 'MyShelf is built with {count} open-source packages: {summary}.' },
      /** One entry of the summary: how many packages use a licence id ("518 MIT"). */
      summaryItem: '{count} {licence}',
      summarySeparator: ', ',
      showAll: { one: 'Show the {count} package', other: 'Show all {count} packages' },
      hide: 'Hide the package list',
      listLabel: 'Open-source packages',
      /** A package, its version and its licence id ("react 19.1.0 — MIT"). */
      packageRow: '{name} {version} — {licence}',
    },
  },
  /** Settings → Pending lookups (P08-10): ISBNs waiting for the internet. */
  pendingLookups: {
    title: 'Pending lookups',
    intro: 'Books you scanned or typed in while offline. MyShelf looks them up when you’re back online.',
    emptyTitle: 'Nothing waiting',
    emptyMessage: 'Every book you’ve added has its details. Lovely.',
    listLabel: 'Pending lookups',
    isbn: 'ISBN {isbn}',
    /** A queued lookup's line: the day it was added, then its status ("Added 12 Oct 2026. Waiting for the internet."). */
    addedOn: 'Added {date}. {status}',
    status: {
      /** {reason} is one of the reasons below. */
      gaveUp: 'Gave up. {reason}',
      notFound: 'No book site knows this ISBN.',
      invalidIsbn: 'This ISBN has a typo in it.',
      unknownError: 'It didn’t work after several tries.',
      retrying: { one: 'Waiting to try again ({count} try so far).', other: 'Waiting to try again ({count} tries so far).' },
      waiting: 'Waiting for the internet.',
    },
    retryLabel: 'Retry {isbn}',
    removeLabel: 'Remove {isbn}',
    /** Snackbars after Retry and Remove. */
    retrying: 'Trying {isbn} again',
    removed: 'Removed {isbn}',
  },

  // Backup, restore, import and export
  /** Backing up, restoring, spreadsheet import and export, and erasing the library (P08). */

  /** Settings → Back up your library, and what a backup holds. */
  backup: {
    screen: {
      title: 'Back up your library',
      intro:
        'One file with every book, author, series, group, borrower, loan and preference. Keep it somewhere safe: Google Drive, an email to yourself, or your computer.',
      contentsTitle: 'What’s in it',
      /** Small label above the card title. */
      contentsEyebrow: 'Backup',
      counting: 'Counting your books…',
      /** {contents} is a list of counts, e.g. "12 books, 4 loans, 2 groups". */
      rightNow: 'Right now: {contents}.',
      coversNote:
        'Covers saved on this phone aren’t in the file; MyShelf fetches them again after a restore. Nothing is uploaded anywhere: you choose where the file goes.',
      /** {date} is a date, or the word for "Never". */
      lastBackup: 'Last backup: {date}',
      save: 'Save a backup',
      /** Title of the Android share sheet. */
      shareDialogTitle: 'Save your MyShelf backup',
      savedTitle: 'Backup saved',
      /** Web: the browser downloaded the file. */
      downloaded: 'Downloaded {fileName}.',
      /** Phone: the share sheet has been used. */
      ready: '{fileName} is ready. Keep it somewhere safe.',
      cantShare: 'This phone can’t share files right now, so the backup couldn’t be saved.',
      failed: 'Sorry, the backup couldn’t be made. Your library is fine; please try again.',
      restoreInstead: 'Restore from a backup instead',
    },
    /** When the last backup was made, when there has not been one. */
    never: 'Never',
    /** What a backup (or the library) holds: "12 books, 4 loans, 2 groups". */
    counts: {
      books: { one: '{count} book', other: '{count} books' },
      series: { one: '{count} series', other: '{count} series' },
      groups: { one: '{count} group', other: '{count} groups' },
      borrowers: { one: '{count} borrower', other: '{count} borrowers' },
      loans: { one: '{count} loan', other: '{count} loans' },
      /** Separator between the counts. */
      separator: ', ',
      none: 'no books',
    },
    /** Joins whole sentences shown one after another in the same paragraph. */
    sentenceSeparator: ' ',
  },
  /** Settings → Restore from a backup, and why a backup file can't be restored. */
  restore: {
    screen: {
      title: 'Restore from a backup',
      intro: 'Choose a backup file MyShelf saved. You’ll see what’s in it before anything changes.',
      chooseFile: 'Choose a backup file',
      chooseDifferentFile: 'Choose a different file',
      errorTitle: 'That file can’t be restored',
      openFailed: 'Sorry, that file couldn’t be opened. Nothing was changed.',
      restoreFailed: 'Sorry, the restore didn’t work. Nothing was changed.',
      /** Shown before a file is chosen. */
      fileNameHint: 'Backups are files named like myshelf-backup-2026-10-12.json.',
    },
    file: {
      /** Small label above the file name. */
      eyebrow: 'Backup file',
      /** {contents} is a list of counts, e.g. "12 books, 4 loans, 2 groups". */
      holds: 'It holds {contents}.',
      /** The file's details are these fragments, joined with a space: "Saved 12 Oct 2026 by MyShelf 1.0.0". */
      savedOn: 'Saved {date}',
      byVersion: 'by MyShelf {version}',
      fromOlderVersion: 'from an older version; it will be brought up to date',
      /** Between the fragments above. */
      detailsSeparator: ' ',
    },
    mode: {
      label: 'How should it be restored?',
      replace: 'Replace my library',
      replaceDescription: 'Everything on this phone is swapped for the backup. A safety copy is kept so you can undo.',
      merge: 'Add to my library',
      mergeDescription: 'Books you don’t have yet are added. Nothing is removed or changed.',
    },
    confirm: {
      /** The word typed to confirm a Replace; shown and typed in capitals. */
      word: 'REPLACE',
      label: 'Type {word} to confirm',
      helper: 'Your current library will be replaced.',
      replace: 'Replace my library',
      merge: 'Add these books',
    },
    result: {
      mergedTitle: 'Books added',
      replacedTitle: 'Library restored',
      added: { one: 'Added {count} book.', other: 'Added {count} books.' },
      /** Follows "Added 3 books." */
      alreadyOnShelf: { one: '{count} was already on your shelf.', other: '{count} were already on your shelf.' },
      /** {contents} is a list of counts, e.g. "12 books, 4 loans, 2 groups". */
      libraryNowHas: 'Your library now has {contents}.',
      upgraded: 'The backup came from an older version of MyShelf and was brought up to date.',
      seeShelf: 'See your shelf',
      undo: 'Undo restore',
    },
    undo: {
      title: 'Changed your mind?',
      button: 'Undo the last restore',
      /** {books} is a count such as "12 books". */
      body: 'MyShelf kept a copy of your library from just before the last restore ({date}, {books}).',
      /** Stands in for the date when the copy's date is unknown. */
      recently: 'recently',
      done: 'Your library is back as it was.',
      nothingToUndo: 'There was nothing to undo.',
      failed: 'Sorry, I couldn’t undo that. Your library is unchanged.',
    },
    /** One row of a backup table, for the messages below: "book 7", "book–author link 3". */
    rowNames: {
      series: 'series {number}',
      books: 'book {number}',
      authors: 'author {number}',
      bookAuthors: 'book–author link {number}',
      genres: 'genre {number}',
      bookGenres: 'book–genre link {number}',
      groups: 'group {number}',
      groupBooks: 'group–book link {number}',
      borrowers: 'borrower {number}',
      loans: 'loan {number}',
      pendingLookups: 'pending lookup {number}',
      settings: 'setting {number}',
    },
    /** A backup table as a whole, for the messages below: "its book authors are missing". */
    tableNames: {
      series: 'series',
      books: 'books',
      authors: 'authors',
      bookAuthors: 'book authors',
      genres: 'genres',
      bookGenres: 'book genres',
      groups: 'groups',
      groupBooks: 'group books',
      borrowers: 'borrowers',
      loans: 'loans',
      pendingLookups: 'pending lookups',
      settings: 'settings',
    },
    /**
     * Why a file can't be restored. {row} is a row name such as "book 7";
     * {field}, {name} and {columns} are the file's own names for fields and
     * tables (e.g. “series_id”), left as they are.
     */
    errors: {
      empty: 'That file is empty. Choose the backup file MyShelf saved.',
      notJson: 'That file couldn’t be read as a MyShelf backup. It may be incomplete or a different kind of file. Nothing was changed.',
      notBackup: 'That file isn’t a MyShelf backup. Choose a file named like myshelf-backup-2026-10-12.json.',
      newerVersion: 'This backup was made by a newer version of MyShelf. Update the app, then try again.',
      noFormatVersion: 'This backup looks damaged: its format version is missing. Nothing was changed.',
      noSchemaVersion: 'This backup looks damaged: its schema version is missing. Nothing was changed.',
      noTables: 'This backup looks damaged: it has no tables. Nothing was changed.',
      tableTooNew: 'This backup looks damaged: it has “{name}”, which its version shouldn’t have. Nothing was changed.',
      unknownTable: 'This backup looks damaged: it has a table MyShelf doesn’t know (“{name}”). Nothing was changed.',
      /** {tables} is a table name such as "book authors". */
      tableMissing: 'This backup looks damaged: its {tables} are missing. Nothing was changed.',
      /** {tables} is a table name; {columns} the key's field names ("book_id and author_id"); {values} their values. */
      duplicateKey: 'This backup looks damaged: two {tables} share the same {columns} ({values}). Nothing was changed.',
      notARecord: 'This backup looks damaged: {row} isn’t a record. Nothing was changed.',
      unknownField: 'This backup looks damaged: {row} has an unknown field “{field}”. Nothing was changed.',
      missingField: 'This backup looks damaged: {row} is missing “{field}”. Nothing was changed.',
      unexpectedField: 'This backup looks damaged: {row} has an unexpected “{field}”. Nothing was changed.',
      emptyField: 'This backup looks damaged: {row} has an empty {field}. Nothing was changed.',
      /** {value} is the stored rating that is out of range. */
      badRating: 'This backup looks damaged: {row} has a rating of {value}; ratings are 1 to 5 stars. Nothing was changed.',
      /** {target} is a row name such as "book 999". */
      brokenLink: 'This backup looks damaged: {row} points at {target}, which isn’t in the file. Nothing was changed.',
      /** The database refused the backup's rows while restoring. */
      recordsClash: 'This backup looks damaged: two records clash. Nothing was changed.',
      badValue: 'This backup looks damaged: a record has a value MyShelf can’t accept. Nothing was changed.',
      linkMissing: 'This backup looks damaged: a link points at something missing. Nothing was changed.',
      notSaved: 'This backup looks damaged: something in it couldn’t be saved. Nothing was changed.',
    },
  },
  /** Settings → Import books from a spreadsheet. */
  importCsv: {
    screen: {
      title: 'Import books from a spreadsheet',
      intro:
        'Bring in a list of books from a CSV file: a Goodreads export (My Books → Import and export → Export library), a MyShelf spreadsheet, or your own.',
      chooseFile: 'Choose a CSV file',
      chooseDifferentFile: 'Choose a different file',
      errorTitle: 'That file can’t be imported',
      previewFirst: 'Nothing is added until you’ve seen a preview.',
    },
    /** A number of spreadsheet rows. */
    rows: { one: '{count} row', other: '{count} rows' },
    file: {
      /** Small label above the file name. */
      eyebrow: 'Spreadsheet',
      /** {rows} and {columns} are counts such as "12 rows" and "5 columns". */
      summary: '{rows} of books, {columns}.',
      columnCount: { one: '{count} column', other: '{count} columns' },
    },
    columns: {
      heading: 'Columns',
      presetLabel: 'This file is a',
      needsTitle: 'Choose which column holds the title: every book needs one.',
      shelvesAsGroups: 'Turn shelves into groups',
      shelvesAsGroupsDescription: 'Each shelf (to-read, favourites, …) becomes a MyShelf group holding its books.',
    },
    /** The kinds of spreadsheet the import recognises. */
    presets: {
      goodreads: 'Goodreads library export',
      myshelf: 'MyShelf spreadsheet',
      custom: 'Another spreadsheet (match the columns yourself)',
    },
    /** The column mapper. */
    mapper: {
      /** {name} is the column's heading in the file, or its number such as "#3". */
      columnLabel: 'Column “{name}”',
      columnNumber: '#{number}',
      emptyExample: 'Empty in the first row',
      example: 'For example: {value}',
      noneUsed: 'No column is being used yet. Choose what each column holds below.',
      hideIgnored: 'Hide the columns not imported',
      showIgnored: { one: 'Show the {count} column not imported', other: 'Show the {count} columns not imported' },
    },
    preview: {
      heading: 'Preview',
      /** {books} is a count such as "12 books". */
      willAdd: '{books} will be added.',
      /** {books} and {rows} are counts such as "12 books" and "2 rows". */
      willAddAndSkip: '{books} will be added; {rows} will be skipped.',
      firstRows: 'The first {count} rows:',
      importing: { one: 'Importing {count} book…', other: 'Importing {count} books…' },
      listLabel: 'First rows',
      noTitle: '(no title)',
      byAuthors: 'by {names}',
      willBeAdded: 'Will be added.',
      /** {notes} are the row's warnings, e.g. "The year “sometime” wasn’t understood." */
      willBeAddedWithNotes: 'Will be added. {notes}',
      skipped: 'Skipped: {notes}',
      /** A preview row's accessible name. */
      rowLabel: 'Line {line}: {title}. {status}',
      rowLabelWithAuthors: 'Line {line}: {title} by {names}. {status}',
    },
    confirm: {
      import: { one: 'Import {count} book', other: 'Import {count} books' },
      nothing: 'Nothing to import',
    },
    report: {
      title: { one: 'Imported {count} book', other: 'Imported {count} books' },
      /** {names} is a list of group names. */
      newGroups: 'New groups: {names}.',
      coversComing: 'Covers are being found in the background; they’ll appear on your shelf as they arrive.',
      skipped: { one: '{count} row skipped (listed below).', other: '{count} rows skipped (listed below).' },
      nothingNew: 'Nothing new to add.',
      skippedHeading: 'Skipped rows',
      skippedLine: 'Line {line}: {reason}',
      skippedLineWithTitle: 'Line {line} ({title}): {reason}',
      seeShelf: 'See your shelf',
      /** Looks the imported books up for what the file lacked (summary, genres, series…). */
      fetchDetails: 'Fetch missing details',
      fetchDetailsHint: 'I can look these books up and offer what the file didn’t have, like summaries, genres and series. You choose what to add.',
    },
    /** Why a row is not imported. */
    reasons: {
      emptyRow: 'The row is empty.',
      noTitle: 'It has no title.',
      twiceInFile: 'It appears twice in the file.',
      alreadyOnShelf: 'It’s already on your shelf.',
    },
    /** Something in a row that was left out; {value} is the cell as written. */
    warnings: {
      badIsbn: 'The ISBN “{value}” isn’t valid, so it was left out.',
      badYear: 'The year “{value}” wasn’t understood.',
      badPages: 'The page count “{value}” wasn’t understood.',
      badRating: 'The rating “{value}” wasn’t understood, so it was left out.',
      badAdded: 'The date added “{value}” wasn’t understood, so the book is dated today.',
      shortened: 'The title or an author’s name was over {max} characters, so it was shortened.',
    },
    errors: {
      empty: 'That file is empty. Choose a spreadsheet saved as CSV.',
      cutShort: 'That file looks cut short: a quoted cell starting on line {line} never ends. Try exporting it again.',
      noHeader: 'That file has no header row. The first line should name the columns, like Title and Author.',
      looksLikeBackup: 'That looks like a backup file, not a spreadsheet. Use “Restore from a backup” for it.',
      noRows: 'That file has a header but no books under it.',
      unreadable: 'Sorry, that file couldn’t be read. Is it a CSV spreadsheet?',
      importFailed: 'Sorry, the import didn’t work, so nothing was added. Please try again.',
    },
  },
  /** What a spreadsheet column can become, as the column mapper lists them. */
  csvFields: {
    ignore: 'Don’t import',
    title: 'Title',
    subtitle: 'Subtitle',
    authors: 'Author(s)',
    additionalAuthors: 'More authors (comma-separated)',
    isbn: 'ISBN (10 or 13)',
    isbn13: 'ISBN-13',
    isbn10: 'ISBN-10',
    publisher: 'Publisher',
    year: 'Year published',
    originalYear: 'First published (used when the year is empty)',
    pages: 'Pages',
    format: 'Format (hardback, paperback, …)',
    language: 'Language',
    genres: 'Genres',
    series: 'Series',
    seriesPosition: 'Number in series',
    groups: 'Groups',
    shelves: 'Shelves (comma-separated, become groups)',
    exclusiveShelf: 'Reading shelf (read, to-read, …)',
    rating: 'Your rating (1 to 5 stars)',
    notes: 'Notes',
    privateNotes: 'Private notes (added to notes)',
    added: 'Date added',
  },
  /** Settings → Export as a spreadsheet. */
  exportCsv: {
    screen: {
      title: 'Export as a spreadsheet',
      intro:
        'A CSV file with one row per book, for Excel, Numbers or Google Sheets. It’s a list to read, not a backup: use “Back up your library” to keep everything.',
      columnsTitle: 'Columns',
      /** Small label above the card title. */
      columnsEyebrow: 'CSV',
      columns:
        'Title, subtitle, authors, ISBN-13, ISBN-10, publisher, year, pages, format, language, genres, series, number in series, groups, notes and the date added.',
      includeLoans: 'Include lending details',
      includeLoansDescription: 'Adds who has each book, when it was lent and when it’s due. Borrower names are personal: share this file with care.',
      export: 'Export CSV',
      /** Title of the Android share sheet. */
      shareDialogTitle: 'Save your book list',
      savedTitle: 'Spreadsheet saved',
      /** {books} is a count such as "12 books". Web: the browser downloaded the file. */
      downloaded: 'Downloaded {fileName} with {books}.',
      /** {books} is a count such as "12 books". Phone: the share sheet has been used. */
      ready: '{fileName} is ready, with {books}.',
      cantShare: 'This phone can’t share files right now.',
      failed: 'Sorry, the spreadsheet couldn’t be made. Please try again.',
    },
  },
  /** Settings → Erase library. */
  erase: {
    screen: {
      title: 'Erase library',
      intro: 'Remove every book from this phone, for a fresh start.',
      warningTitle: 'This can’t be undone',
      /** {contents} is a list of counts ("12 books, 4 loans") or the words "every book". */
      warning:
        'Erasing removes {contents}, with their authors, genres, series, groups, borrowers and loan history, any lookups still waiting, and saved covers.',
      everyBook: 'every book',
      backupNudge: 'If there’s any chance you’ll want them back, save a backup first.',
      backupFirst: 'Save a backup first',
      resetSettings: 'Also reset my settings',
      resetSettingsDescription: 'Shelf order, loan length, date format and the rest go back to how they started.',
      continue: 'Continue',
    },
    confirm: {
      /** The word typed to confirm; shown and typed in capitals. */
      word: 'ERASE',
      /** {contents} is a list of counts ("12 books, 4 loans") or the words "your library". */
      lastStep: 'Last step. Type {word} to remove {contents}.',
      lastStepWithSettings: 'Last step. Type {word} to remove {contents} and reset your settings.',
      yourLibrary: 'your library',
      label: 'Type {word} to confirm',
      erase: 'Erase everything',
      keep: 'Keep my library',
      done: 'Your library was erased. A fresh start!',
      failed: 'Sorry, the library couldn’t be erased. Nothing was changed.',
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
        body: 'Sort by up to four things at once (genre, then author, then series…) or pick a preset such as Library order, group by genre, series, author or group, and switch between a list, covers and spines.',
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

  // Scanning and lookups
  /** The Scan tab: barcode and cover scanning, the camera, the tray and scanning help. */
  scan: {
    /** The back button and empty-state action on the screens opened from the Scan tab. */
    backToScanning: 'Back to scanning',
    screen: {
      title: 'Scan a book',
      /** Heading over the small card of the book the last scan found. */
      lastFound: 'Last found',
      /** A toggle chip: scan several books into a tray, then review them together. */
      scanSeveral: 'Scan several',
      scanSeveralLabel: 'Scan several books, then review them together',
      noMatchIsbn: 'No match for that ISBN',
      noMatchCover: 'No match for that cover',
      addByHand: 'Add it by hand',
      /** After a cover search found nothing, or a photo gave no title: edit the words read and search again. */
      typeWords: 'Change the words',
      readCoverInstead: 'Read the cover instead',
      keepScanning: 'Keep scanning',
      /** After a scan in "Scan several" mode; {title} is the book's title. */
      addedToTray: 'Added “{title}” to the tray.',
      needsChoice: '“{title}” needs a choice of edition — pick it when you review.',
      /** The same ISBN scanned again in "Scan several": nothing is added unless the user asks for another copy. */
      alreadyInTray: '“{title}” is already in the tray. Scanned a second copy?',
      addCopy: '+1 copy',
      addCopyLabel: 'Add another copy of {title} to the tray',
    },
    /** Booky's messages while scanning. */
    messages: {
      notBook: 'That’s a product barcode, not a book’s — look for the one starting 978 or 979.',
      invalidIsbn: 'That doesn’t look like an ISBN. It’s the 10 or 13 digits above the barcode, usually starting 978.',
      noCoverText: 'Type the words on the cover first — the title and the author.',
      noCoverRead: 'I couldn’t make out a title on that cover. Try again with the cover filling the frame, or type the words yourself.',
      noCoverWords: 'I couldn’t find any words in that photo. Fill the frame with the front cover, flat and well lit, and try again.',
      offlineCover: 'I can’t reach the library catalogues right now, so I can’t search for that cover. Try again when you’re online.',
      queued: 'Saved — I’ll look this up when you’re back online.',
      /** While a lookup runs; {isbn} is the hyphenated ISBN. */
      lookingUp: 'Looking up {isbn}…',
      /** While a cover search runs; {text} is the title (or text) read off the cover. */
      searching: 'Searching for “{text}”…',
    },
    /** Barcode or cover: a two-way switch at the top of the Scan tab. */
    modeSwitch: {
      groupLabel: 'What to scan',
      barcode: 'Barcode',
      cover: 'Cover',
      barcodeLabel: 'Scan the barcode',
      coverLabel: 'Read the cover',
    },
    barcode: {
      cameraLabel: 'Camera: line up the barcode on the back cover',
      hint: 'Line up the barcode on the back cover',
      /** The torch is the phone's flashlight. */
      torchOff: 'Turn the torch off',
      torchOn: 'Turn the torch on',
      readCover: 'Read the cover',
    },
    cover: {
      unavailable: 'This version of the app can’t read covers by itself. Type what the cover says and I’ll search for it.',
      readFailed: 'I couldn’t read that photo. Try again with the cover flat and well lit.',
      cameraLabel: 'Camera: fill the frame with the front cover',
      hint: 'Fill the frame with the front cover',
      takePhoto: 'Take the photo',
      photoAlt: 'Your photo of the cover',
      retake: 'Retake',
      usePhoto: 'Use this photo',
      /** Opens the phone's photo picker to read a photo of a cover taken earlier. */
      choosePhoto: 'Choose from your photos',
      chooseAnother: 'Choose another',
      reading: 'Reading the cover…',
    },
    /** P03-14: no cover online for a book found from a photo of its cover. {title} is the book's title. */
    coverPhoto: {
      message: 'I couldn’t find a cover for “{title}” online. Shall I use your photo?',
      photoAlt: 'Your photo of the cover of {title}',
      use: 'Use my photo',
      decline: 'No thanks',
      saved: 'Your photo is the cover now.',
      failed: 'I couldn’t use that photo as the cover.',
    },
    permission: {
      askTitle: 'May I use the camera?',
      askBody: 'I use the camera only to read barcodes and covers — nothing leaves your phone.',
      deniedTitle: 'The camera is switched off for MyShelf',
      deniedBody: 'You can switch it back on in your phone’s settings, under MyShelf → Permissions. Or type it in instead.',
      openSettings: 'Open settings',
      allow: 'Allow camera',
      typeIsbn: 'Type ISBN instead',
      typeCoverText: 'Type the cover text instead',
    },
    host: {
      cameraLoading: 'Getting the camera ready…',
      useCamera: 'Use the camera instead',
      /** Leaves the typed cover words for the cover camera and photos again. */
      backToCover: 'Read a photo instead',
      typeIsbn: 'Type the ISBN instead',
      /** The web build is a test harness, not shipped to users. */
      webIsbnNote: 'Web test harness: type the ISBN a barcode would give. On a phone this is the camera.',
      webCoverNote: 'Web test harness: type what the cover says. On a phone the camera reads it.',
    },
    typed: {
      isbnLabel: 'Type an ISBN',
      isbnPlaceholder: 'e.g. 978-0-552-16659-1',
      isbnHelper: 'The 10 or 13 digits above the barcode.',
      lookUp: 'Look up',
      coverLabel: 'Type the cover text',
      /** An example of cover text, one line per line on the cover. */
      coverPlaceholder: 'e.g. THE COLOUR OF MAGIC\nTERRY PRATCHETT',
      coverHelper: 'The title and author as they appear on the cover, one per line.',
      search: 'Search',
    },
    help: {
      title: 'Where’s the barcode?',
      gotIt: 'Got it',
      where: 'Turn the book over: the ISBN barcode is usually at the bottom of the back cover, starting 978 or 979.',
      jacket: 'On a dust jacket, look on the back flap too.',
      noBarcode: 'No barcode (older books often have none)? Switch to Cover and photograph the front: I’ll read the title and author and show you the editions.',
      isbn: 'The ISBN (International Standard Book Number) identifies one edition of a book, so a barcode finds exactly your copy.',
    },
    /** The "Scan several" tray under the scanner. */
    tray: {
      inTray: { one: '{count} book in the tray', other: '{count} books in the tray' },
      empty: 'Scanned books wait here until you review them.',
      needsChoice: { one: '{count} needs a choice of edition', other: '{count} need a choice of edition' },
      review: { one: 'Review {count} book', other: 'Review {count} books' },
      /** A tray row's name when the scan found neither a title nor an ISBN. */
      unknownBook: 'A book',
    },
  },
  /** `/scan/review`: the books in the "Scan several" tray, saved together. */
  scanReview: {
    title: 'Review your scans',
    intro: 'Check each book, choose an edition where I wasn’t sure, and drop any you don’t want.',
    listLabel: 'Scanned books',
    /** A rubber stamp on a tray row whose edition is not chosen yet. */
    needsChoice: 'Needs a choice',
    choose: 'Choose the edition',
    drop: 'Drop',
    dropLabel: 'Drop {title} from the tray',
    saveFailed: 'Sorry, I couldn’t save every book. The ones left are still in the tray.',
    emptyTitle: 'The tray is empty',
    emptyMessage: 'Turn on “Scan several” on the Scan tab and every book you scan waits here.',
    waiting: {
      one: '{count} book still needs an edition and will stay in the tray.',
      other: '{count} books still need an edition and will stay in the tray.',
    },
    save: { one: 'Save {count} book', other: 'Save {count} books' },
    nothingReady: 'Nothing ready to save',
    /** A rubber stamp on a tray row for a book the shelf already has. */
    onShelf: 'Already on your shelf',
    onShelfCount: { one: 'You have {count} copy of this book already.', other: 'You have {count} copies of this book already.' },
    keep: 'Add it anyway',
    keepLabel: 'Add another copy of {title} anyway',
    keeping: 'Another copy will be added.',
    onShelfWaiting: {
      one: '{count} book is already on your shelf: add it anyway, or drop it.',
      other: '{count} books are already on your shelf: add them anyway, or drop them.',
    },
    copies: { one: '{count} copy', other: '{count} copies' },
    removeCopy: 'Remove a copy',
    removeCopyLabel: 'Remove a copy of {title}',
  },
  /** `/scan/pick`: the edition picker. */
  editions: {
    picker: {
      expiredTitle: 'This scan has expired',
      expiredMessage: 'I only keep a scan while you’re choosing its edition. Scan the book again and I’ll look it up.',
      titleSingle: 'Is this your book?',
      titleMany: 'Which edition is yours?',
      introSingle: 'Here’s the book that barcode belongs to. Check it matches the one in your hands.',
      introMany: {
        one: 'I found one book that could be yours. Open one to see its editions.',
        other: 'I found {count} books that could be yours. Open one to see its editions.',
      },
      copyrightHint: 'Match the publisher and year on the copyright page, just inside the cover.',
      anyFormat: 'Any format',
      anyLanguage: 'Any language',
      /** The group around the one edition an ISBN found. */
      yourBook: 'Your book',
      loadFailed: 'I couldn’t load its editions just now. You can still choose the book itself.',
      noMatch: 'No editions match those filters.',
      showMore: { one: 'Show {count} more edition', other: 'Show {count} more editions' },
      /** A work with more editions than the first page: loads the next page. {loaded} of {total} are loaded. */
      loadMore: 'Show more editions',
      loadMoreLabel: 'Show more editions: {loaded} of {total} loaded',
      loadedOf: '{loaded} of {total} editions loaded',
      loadMoreFailed: 'I couldn’t load more editions just now. Try again in a moment.',
      /** Filters found nothing among the editions loaded so far, and there are more. */
      noMatchYet: 'None of the {loaded} editions loaded so far match. Show more to look through the rest.',
      findEdition: 'Find your edition',
      findEditionPlaceholder: 'Year, publisher or ISBN',
      findEditionHelp: 'From the copyright page, e.g. 1998, Tor or 978-0-312-85848-9.',
      reviewBeforeSaving: 'Review before saving',
      reviewBeforeSavingLabel: 'Review the details in the form before saving',
      none: 'None of these — add manually',
      /** Confirms the edition of a book waiting in the "Scan several" tray. */
      useThisEdition: 'Use this edition',
      thisIsMyEdition: 'This is my edition',
    },
    /** A work (all editions of one book) in the picker. */
    work: {
      firstPublished: 'First published {year}',
      editionCount: { one: '{count} edition', other: '{count} editions' },
      by: 'by {author}',
      /** Joins the facts shown under the title, e.g. "First published 1983 · 12 editions". */
      factSeparator: ' · ',
      /** Joins the parts of the screen reader label. */
      labelSeparator: ', ',
      /** {label} is the work's title, author and facts. */
      show: '{label}. Show its editions',
      hide: '{label}. Hide its editions',
      editionsOf: 'Editions of {title}',
    },
    /** What a screen reader says for one edition: "Hardback, Doubleday, 1987, 285 pages, ISBN …, The Colour of Magic, from Open Library, with a cover picture". */
    row: {
      separator: ', ',
      pages: { one: '{count} page', other: '{count} pages' },
      isbn: 'ISBN {isbn}',
      noIsbn: 'no ISBN',
      /** {source} is a catalogue name, e.g. "Open Library". */
      from: 'from {source}',
      withCover: 'with a cover picture',
      noCover: 'no cover picture',
    },
  },
  /** "Already on your shelf": a scan matched a book that is already catalogued. */
  duplicate: {
    title: 'Already on your shelf',
    copies: { one: 'You’ve catalogued this book before.', other: 'You’ve catalogued {count} copies of this book.' },
    question: 'Is this another copy, or the same book scanned twice?',
    addCopy: 'Add another copy',
    open: 'Open it',
  },
  /** "Find it online" on the add form, and the offline lookup queue. */
  lookup: {
    messages: {
      invalid: 'That doesn’t look like an ISBN. It’s the 10 or 13 digits above the barcode, usually starting 978.',
      empty: 'Type an ISBN first — it’s on the back cover, above the barcode.',
      emptySearch: 'Type a title, an author, or both.',
      offline: 'I can’t reach the library catalogues right now. You can still type the book in by hand.',
      busy: 'The catalogues asked me to slow down. Please try again in a minute.',
    },
    /** When one of the two catalogues did not answer. */
    warnings: {
      googlebooks: 'Google Books didn’t answer, so these come from Open Library only.',
      openlibrary: 'Open Library didn’t answer, so these come from Google Books only.',
    },
    /** The add form was started from words read off a cover. */
    guess: {
      title: 'Please check',
      /** {fields} is a list such as "title and author"; {count} is how many fields. */
      message: {
        one: 'I guessed the {fields} from the cover. Check it against your book before saving.',
        other: 'I guessed the {fields} from the cover. Check them against your book before saving.',
      },
      fields: {
        title: 'title',
        authors: 'author',
        isbn: 'ISBN',
      },
    },
    /** "Find a cover online" on the book form. */
    cover: {
      needDetails: 'Add the ISBN, or the title and author, and I’ll look for the cover.',
      notFound: 'I couldn’t find a cover online for this one. You can photograph yours instead.',
      found: 'Found the cover and put it on the card.',
      offline: 'I can’t reach the catalogues right now. Try again when you’re online.',
      failed: 'Sorry, I couldn’t look for a cover just now.',
    },
    pending: {
      /** Fills {them} in Booky's "You can add {them} by hand": the books that were given up on. */
      them: { one: 'it', other: 'them' },
      ok: 'OK',
      okLabel: 'OK, forget those lookups',
    },
  },
  /** `/book/[id]/refresh`: look a book up again and choose which details to update. */
  refresh: {
    title: 'Refresh details',
    backToBook: 'Back to the book',
    checking: 'Checking the library catalogues for anything new…',
    offline: 'I can’t reach the library catalogues right now. Try again when you’re online.',
    updated: { one: 'Updated {count} detail', other: 'Updated {count} details' },
    saveFailed: 'Sorry, I couldn’t save those changes. Please try again.',
    notFoundTitle: 'No catalogue knows this one',
    notFoundMessage: 'I couldn’t find this book online, so there’s nothing to refresh. Its card stays just as it is.',
    upToDateTitle: 'Everything’s up to date',
    /** {source} is a catalogue name, e.g. "Open Library". */
    upToDateMessage: '{source} has nothing to add to this card.',
    changes: {
      one: '{source} has one change. Tick the ones you want; your own genres always stay.',
      other: '{source} has {count} changes. Tick the ones you want; your own genres always stay.',
    },
    changesLabel: 'Changes to apply',
    update: { one: 'Update {count} detail', other: 'Update {count} details' },
    nothingTicked: 'Nothing ticked',
  },
  /** "Fetch missing details" for books imported from a spreadsheet (P08-05). */
  fetchDetails: {
    title: 'Fetch missing details',
    intro: 'Details the catalogues have that your file didn’t. Nothing you imported is replaced, and your ratings and notes stay as they are.',
    checking: { one: 'Looking up {done} of {total} book…', other: 'Looking up {done} of {total} books…' },
    stop: 'Stop and review',
    offline: 'I went offline before I could look up every book. Here’s what I found; try again later for the rest.',
    /** Parts of the summary, joined into one sentence list. */
    found: { one: '{count} book has something to add.', other: '{count} books have something to add.' },
    upToDate: { one: '{count} has nothing new.', other: '{count} have nothing new.' },
    notFound: { one: '{count} isn’t in the catalogues.', other: '{count} aren’t in the catalogues.' },
    failed: { one: '{count} couldn’t be looked up.', other: '{count} couldn’t be looked up.' },
    nothingTitle: 'Nothing to add',
    nothingMessage: 'The catalogues had nothing your books were missing.',
    /** A book's section: its title, and the changes as a group named after it. */
    bookChanges: 'Details for “{title}”',
    apply: { one: 'Add {count} detail', other: 'Add {count} details' },
    nothingTicked: 'Nothing ticked',
    notNow: 'Not now',
    saved: { one: 'Added details to {count} book.', other: 'Added details to {count} books.' },
    saveFailed: 'Sorry, I couldn’t save those details. Please try again.',
    seeShelf: 'See your shelf',
  },
  /** The end-to-end test harness screens (only in test builds). */
  e2e: {
    loading: 'Setting out the books…',
    handingOver: 'Handing the scan over…',
    loadFailed: 'Couldn\'t load the fixture',
    unknownFixture: 'Unknown fixture "{name}". Try one of: {names}.',
    /** "today" is a URL parameter name; keep it as it is. */
    badToday: '"today" must be a YYYY-MM-DD date, got "{value}".',
  },
} as const;
