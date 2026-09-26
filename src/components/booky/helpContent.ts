import type { HelpScreen } from './tips';

/**
 * The help sheet's words (P07-05): a few short sections per screen, opened
 * from Booky's help tip ("More help") or, with Booky off, straight from the
 * screen's help button. Same copy rules as the tips (see `tips.ts`), with a
 * little more room: each section at most three short sentences.
 */

export interface HelpSection {
  heading: string;
  body: string;
}

export interface HelpContent {
  title: string;
  sections: readonly HelpSection[];
}

export const helpContent: Record<HelpScreen, HelpContent> = {
  shelf: {
    title: 'Your shelf',
    sections: [
      { heading: 'Finding a book', body: 'Type in the search box: a title, an author, a series or an ISBN all work.' },
      { heading: 'Sort, group and view', body: 'Sort by title, author or date added, group by genre, series, author or group, and switch between a list, covers and spines.' },
      { heading: 'Several at once', body: 'Tap Select (or press and hold a book) to pick several, then add them to a group or remove them. You can undo a removal for a few seconds.' },
    ],
  },
  scan: {
    title: 'Scanning a book',
    sections: [
      { heading: 'Where is the ISBN?', body: 'Turn the book over: the ISBN barcode is usually at the bottom of the back cover, starting 978 or 979. On a dust jacket, look on the back flap too.' },
      { heading: 'No barcode?', body: 'Older books often have none. Switch to Cover and photograph the front: I’ll read the title and author and show you the editions.' },
      { heading: 'Scanning a pile', body: 'Turn on “Scan several” and every book waits in a tray, so you can check them all at the end.' },
    ],
  },
  loans: {
    title: 'Loans',
    sections: [
      { heading: 'Lending a book', body: 'Open the book on your shelf and tap Lend. Pick who has it and when it’s due back.' },
      { heading: 'When it comes back', body: 'Tap “Mark returned”. The loan moves to History, so you can see who borrowed what.' },
      { heading: 'Reminders', body: 'Turn on reminders in Settings and I’ll send a gentle note on the due date. I also mention overdue books when you open the app.' },
    ],
  },
  groups: {
    title: 'Groups',
    sections: [
      { heading: 'What is a group?', body: 'Your own little shelf: favourites, a book club, books to read next. A book can be in as many groups as you like.' },
      { heading: 'Adding books', body: 'Open a group and tap “Add books”, or select books on the Shelf and choose “Add to group”.' },
      { heading: 'Changing the order', body: 'In a group, choose Reorder and move books up or down.' },
    ],
  },
  settings: {
    title: 'Settings',
    sections: [
      { heading: 'How chatty is Booky?', body: 'Helpful: all my tips. Quiet: only problems, empty screens and help when you ask. Off: I stay out of sight, but the help buttons still work.' },
      { heading: 'Tips you’ve muted', body: '“Reset tips” brings back every tip you’ve seen or asked me not to show again.' },
    ],
  },
  book: {
    title: 'A book’s card',
    sections: [
      { heading: 'Editing details', body: 'Tap the pencil to change anything: title, authors, genres, series or your own notes.' },
      { heading: 'What is an edition?', body: 'The same book printed by a different publisher, in a different year or format. Each edition has its own ISBN.' },
      { heading: 'Lending', body: 'Lend the book from here, and mark it returned when it comes home.' },
    ],
  },
  editions: {
    title: 'Choosing an edition',
    sections: [
      { heading: 'What is an edition?', body: 'The same book printed by a different publisher, in a different year or format. Each edition has its own ISBN.' },
      { heading: 'Which one is mine?', body: 'Compare the cover, the publisher and the year with the book in your hands. The ISBN on the back is the surest match.' },
      { heading: 'Not sure?', body: 'Pick the closest one. You can change any detail later from the book’s card.' },
    ],
  },
  series: {
    title: 'Series',
    sections: [
      { heading: 'How do series gaps work?', body: 'I line the books up by their number. A dashed spine is a number you don’t have yet: tap it to add that book.' },
      { heading: 'Setting the total', body: 'Tell me how many books the series has, and I’ll show the ones missing at the end too, and cheer when it’s complete.' },
      { heading: 'Tidying up', body: 'Rename a series, or merge two that are really one, from the menu at the top.' },
    ],
  },
};
