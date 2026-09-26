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
      /** {summary} is e.g. "Title, A to Z". */
      sortButton: 'Sort: {summary}',
      sortButtonLabel: 'Sort by {summary}',
      sortSummary: '{field}, {direction}',
      /** {grouping} is e.g. "Genre". */
      groupButton: 'Group: {grouping}',
      groupButtonLabel: 'Group by {grouping}',
      filter: 'Filter',
      filterCount: 'Filter ({count})',
      filterCountLabel: 'Filter, {count} on',
      select: 'Select',
      selectBooks: 'Select books',
      sortBy: 'Sort by',
      groupBy: 'Group by',
      /** The sort direction button; {direction} is e.g. "A to Z". */
      orderLabel: 'Order: {direction}. Tap to reverse',
    },
    sort: {
      title: 'Title',
      author: 'Author',
      year: 'Year',
      added: 'Recently added',
      rating: 'Rating',
    },
    direction: {
      aToZ: 'A to Z',
      zToA: 'Z to A',
      oldestFirst: 'Oldest first',
      newestFirst: 'Newest first',
      highestFirst: 'Highest first',
      lowestFirst: 'Lowest first',
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
