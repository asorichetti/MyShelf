import type { BookyExpression } from './expressions';
import type { TipVars } from './format';

/**
 * Booky's tip catalogue (P07-01): every word Booky says unprompted, or when
 * asked through a help button, is here. Nothing is generated.
 *
 * Copy guidelines
 * - At most two short lines in a bubble: 120 characters once the
 *   placeholders are filled (the catalogue test checks it with `sample`).
 * - Warm and bookish, never blaming: "I couldn't find that one", not "You
 *   scanned the wrong code".
 * - No jargon; say what a thing is the first time ("the ISBN, the number
 *   above the barcode").
 * - British English, curly quotes and apostrophes.
 * - `{placeholders}` are filled at runtime from the event's `vars`.
 *
 * Which tip shows, and when, is decided by the engine (`engine.ts`): the
 * trigger, `when`, the mode, the frequency, the mute list and the cooldown.
 */

/** App events Booky listens for (`booky.emit(event)`). */
export const bookyTriggers = [
  'app-first-launch',
  'app-foreground',
  'shelf-empty',
  'scan-opened',
  'scan-idle',
  'lookup-none',
  'lookup-arrived',
  'book-added',
  'offline-queued',
  'loan-overdue',
  'series-gap',
  'series-complete',
  'help-requested',
  'backup-due',
] as const;

export type BookyTrigger = (typeof bookyTriggers)[number];

/**
 * - `once`: never again once shown (per `key`, e.g. once per series).
 * - `session`: once per app session.
 * - `daily`: once per day (per `key`, e.g. per loan).
 * - `always`: every time the trigger fires.
 */
export type TipFrequency = 'once' | 'session' | 'daily' | 'always';

/** The Booky modes a tip shows in. Off shows only help, without the character. */
export type TipMode = 'helpful' | 'quiet';

/**
 * - `nudge`: Booky speaks up unprompted. Nudges share a cooldown, never show
 *   while a dialog or sheet is open, and give way to what the user is doing.
 * - `feedback`: a reply to something the user just did ("Shelved!").
 * - `help`: the user asked (a help button).
 */
export type TipKind = 'nudge' | 'feedback' | 'help';

/** A tip's button: `href` navigates (placeholders allowed), `id` is handled by whoever emitted the event. */
export type TipAction = { label: string; href: string } | { label: string; id: TipActionId };

export type TipActionId = 'help-more' | 'read-cover';

/**
 * Where the tip appears: `overlay` floats above the tab bar (the default),
 * `inline` is drawn by the screen that asked for it (the scan screen's
 * "No barcode?"), `onboarding` belongs to the first-run cards.
 */
export type TipPlacement = 'overlay' | 'inline' | 'onboarding';

/** Test ids a tip keeps from the feature that introduced it (P04-07, P04-08). */
export type TipTestGroup = 'seriesTip' | 'seriesCelebration';

export interface TipDef {
  id: string;
  trigger: BookyTrigger;
  /** Narrows the trigger: the help screen, or a variant such as `batch`. */
  when?: { screen?: string; variant?: string };
  expression: BookyExpression;
  title?: string;
  text: string;
  action?: TipAction;
  /** Higher wins when several tips are eligible, and may replace a lower one on screen. */
  priority: number;
  frequency: TipFrequency;
  modes: readonly TipMode[];
  kind: TipKind;
  placement?: TipPlacement;
  /** Put away when the user moves to another screen, so it never sits over that screen's actions. */
  screenBound?: boolean;
  /** First-run guidance: not shown to E2E fixtures unless the fixture asks for the first-run experience. */
  welcome?: boolean;
  /** At most once in this many milliseconds ("Shelved!": once per 10 s). */
  minIntervalMs?: number;
  /** Booky's big moment: excited, with falling bookmarks (P04-08). */
  celebration?: boolean;
  testGroup?: TipTestGroup;
  /** Placeholder values for the catalogue test (and a preview of the longest likely text). */
  sample?: TipVars;
}

const both: readonly TipMode[] = ['helpful', 'quiet'];
const helpfulOnly: readonly TipMode[] = ['helpful'];
const more: TipAction = { label: 'More help', id: 'help-more' };

/** The screens with a help button (P07-05), in tab order and then the rest. */
export const helpScreens = ['shelf', 'scan', 'loans', 'groups', 'settings', 'book', 'editions', 'series'] as const;
export type HelpScreen = (typeof helpScreens)[number];

function help(screen: HelpScreen, text: string): TipDef {
  return { id: `help-${screen}`, trigger: 'help-requested', when: { screen }, expression: 'thinking', text, action: more, priority: 100, frequency: 'always', modes: both, kind: 'help', screenBound: true };
}

export const tips: readonly TipDef[] = [
  // First launch: the onboarding's first card says it.
  {
    id: 'welcome',
    trigger: 'app-first-launch',
    expression: 'happy',
    text: 'Hi, I’m Booky! Let’s fill your shelf.',
    priority: 100,
    frequency: 'once',
    modes: both,
    kind: 'nudge',
    placement: 'onboarding',
  },
  {
    id: 'shelf-empty',
    trigger: 'shelf-empty',
    expression: 'happy',
    text: 'Your shelf is empty. Tap Scan to add your first book.',
    priority: 30,
    frequency: 'session',
    modes: both,
    kind: 'nudge',
    screenBound: true,
    welcome: true,
  },
  {
    id: 'scan-first-visit',
    trigger: 'scan-opened',
    expression: 'thinking',
    text: 'Point me at the barcode on the back cover.',
    priority: 40,
    frequency: 'once',
    modes: helpfulOnly,
    kind: 'nudge',
    screenBound: true,
    welcome: true,
  },
  {
    id: 'scan-idle',
    trigger: 'scan-idle',
    expression: 'thinking',
    text: 'No barcode? Try reading the cover instead.',
    action: { label: 'Read the cover', id: 'read-cover' },
    priority: 40,
    frequency: 'session',
    modes: helpfulOnly,
    kind: 'nudge',
    placement: 'inline',
  },
  // Lookups that found nothing are shown in place, where the user is looking, in every mode.
  {
    id: 'lookup-none',
    trigger: 'lookup-none',
    expression: 'concerned',
    text: 'I couldn’t find that one. Let’s add it by hand — it only takes a minute.',
    priority: 80,
    frequency: 'always',
    modes: both,
    kind: 'feedback',
    placement: 'inline',
  },
  {
    id: 'lookup-none-scan',
    trigger: 'lookup-none',
    when: { variant: 'scan' },
    expression: 'concerned',
    text: 'I couldn’t find that one. Let’s add it by hand — I’ll fill in what I know.',
    priority: 80,
    frequency: 'always',
    modes: both,
    kind: 'feedback',
    placement: 'inline',
  },
  {
    id: 'lookup-gave-up',
    trigger: 'lookup-none',
    when: { variant: 'offline' },
    expression: 'concerned',
    text: 'I couldn’t find details for {books}. You can add {them} by hand.',
    priority: 55,
    frequency: 'always',
    modes: both,
    kind: 'feedback',
    sample: { books: '12 books', them: 'them' },
  },
  {
    id: 'lookup-arrived',
    trigger: 'lookup-arrived',
    expression: 'excited',
    text: 'Good news — I found details for {books} you added offline.',
    priority: 55,
    frequency: 'always',
    modes: helpfulOnly,
    kind: 'feedback',
    sample: { books: '12 books' },
  },
  {
    id: 'book-added',
    trigger: 'book-added',
    expression: 'excited',
    text: 'Shelved! That’s {books}.',
    priority: 50,
    frequency: 'always',
    minIntervalMs: 10_000,
    modes: helpfulOnly,
    kind: 'feedback',
    sample: { books: '1,234 books' },
  },
  {
    id: 'book-added-milestone',
    trigger: 'book-added',
    when: { variant: 'milestone' },
    expression: 'excited',
    text: 'Shelved! That’s {books}. What a milestone!',
    priority: 52,
    frequency: 'always',
    minIntervalMs: 10_000,
    modes: helpfulOnly,
    kind: 'feedback',
    sample: { books: '1,000 books' },
  },
  {
    id: 'book-added-batch',
    trigger: 'book-added',
    when: { variant: 'batch' },
    expression: 'excited',
    text: 'Shelved {saved}! That’s {books} in all.',
    priority: 50,
    frequency: 'always',
    modes: helpfulOnly,
    kind: 'feedback',
    sample: { saved: '25 books', books: '1,234 books' },
  },
  {
    id: 'offline-queued',
    trigger: 'offline-queued',
    expression: 'sleepy',
    text: 'Saved — I’ll look this up when you’re back online.',
    priority: 60,
    frequency: 'always',
    modes: both,
    kind: 'feedback',
  },
  {
    id: 'loan-overdue',
    trigger: 'loan-overdue',
    expression: 'concerned',
    title: 'A gentle nudge',
    text: '“{title}” was due back from {borrower} {when}.',
    action: { label: 'Open loans', href: '/loans' },
    priority: 60,
    frequency: 'daily',
    modes: helpfulOnly,
    kind: 'nudge',
    screenBound: true,
    sample: { title: 'The Curious Incident of the Dog in the Night-Time', borrower: 'Alexandra', when: '12 days ago' },
  },
  {
    id: 'series-gap',
    trigger: 'series-gap',
    expression: 'thinking',
    text: '{have} — {missing}',
    action: { label: 'See the series', href: '/series/{seriesId}' },
    priority: 70,
    frequency: 'once',
    modes: helpfulOnly,
    kind: 'nudge',
    testGroup: 'seriesTip',
    sample: { have: 'You have #1, #2, #4 and #6 of A Series of Unfortunate Events', missing: '#3 and #5 are missing.', seriesId: 12 },
  },
  {
    id: 'series-complete',
    trigger: 'series-complete',
    expression: 'excited',
    title: 'Hooray!',
    text: 'Series complete! {whole}.',
    action: { label: 'See the series', href: '/series/{seriesId}' },
    priority: 90,
    frequency: 'always',
    modes: both,
    kind: 'feedback',
    celebration: true,
    testGroup: 'seriesCelebration',
    sample: { whole: 'All 13 A Series of Unfortunate Events books', seriesId: 12 },
  },
  {
    id: 'backup-due',
    trigger: 'backup-due',
    expression: 'sleepy',
    text: 'It’s been a while since your last backup. Shall we save a copy of your library?',
    action: { label: 'Back up', href: '/settings' },
    priority: 20,
    frequency: 'daily',
    modes: helpfulOnly,
    kind: 'nudge',
    screenBound: true,
  },
  // Help buttons (P07-05): one tip per screen; "More help" opens the help sheet.
  {
    id: 'help-booky',
    trigger: 'help-requested',
    when: { screen: 'booky' },
    expression: 'excited',
    title: 'Hi, I’m Booky!',
    text: 'I keep track of your books, who has borrowed them, and which series you’re part-way through.',
    priority: 100,
    frequency: 'always',
    modes: both,
    kind: 'help',
  },
  help('shelf', 'This is your shelf. Search, sort or group your books, and tap one to see its details.'),
  help('scan', 'Scan the barcode on the back cover, or switch to Cover and I’ll read the title instead.'),
  help('loans', 'Books you’ve lent out live here. Tap “Mark returned” when one comes home.'),
  help('groups', 'Groups are your own shelves: favourites, a book club, anything you like.'),
  help('settings', 'Choose how chatty I am, and set up reminders for books you’ve lent.'),
  help('book', 'Everything about this book. Lend it, add it to a group or edit its details from here.'),
  help('editions', 'Pick the edition that matches your copy: check the cover, the publisher and the year.'),
  help('series', 'The whole series in order. Dashed spines are the books you don’t have yet.'),
];

const byId = new Map(tips.map((t) => [t.id, t]));

/** A tip by id; throws for an unknown id (a typo in code, caught by tests). */
export function tipById(id: string): TipDef {
  const tip = byId.get(id);
  if (!tip) throw new Error(`Booky has no tip "${id}"`);
  return tip;
}
