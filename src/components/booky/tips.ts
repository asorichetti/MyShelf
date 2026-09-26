import type { MessageKey } from '@/i18n';

import { messageTemplate, type TipVars } from './format';

import type { BookyExpression } from './expressions';

/**
 * Booky's tip catalogue (P07-01): every tip Booky gives unprompted, or when
 * asked through a help button, is here. Nothing is generated. The words
 * themselves are in the i18n catalogue (`tips.*` in
 * `src/i18n/en.ts`): each entry names its keys, and a tip's
 * `text`, `title` and action `label` read the active language when read.
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

export type TipActionId = 'help-more' | 'read-cover' | 'backup-later';

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
  /** A quieter second button ("Later"). */
  secondary?: TipAction;
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
/** A tip's button as the catalogue writes it: its label is a catalogue key. */
type ActionSpec = { label: MessageKey; href: string } | { label: MessageKey; id: TipActionId };

/** A catalogue entry: a `TipDef` whose words are catalogue keys. */
type TipSpec = Omit<TipDef, 'text' | 'title' | 'action' | 'secondary'> & { text: MessageKey; title?: MessageKey; action?: ActionSpec; secondary?: ActionSpec };

/** A field that reads its words from the catalogue whenever it is read (never at import). */
const words = (key: MessageKey): PropertyDescriptor => ({ get: () => messageTemplate(key), enumerable: true });

function action({ label, ...rest }: ActionSpec): TipAction {
  return Object.defineProperty({ ...rest }, 'label', words(label)) as TipAction;
}

function tip({ text, title, action: act, secondary, ...rest }: TipSpec): TipDef {
  const def = { ...rest } as TipDef;
  Object.defineProperty(def, 'text', words(text));
  if (title) Object.defineProperty(def, 'title', words(title));
  if (act) def.action = action(act);
  if (secondary) def.secondary = action(secondary);
  return def;
}

const more: ActionSpec = { label: 'tips.actions.moreHelp', id: 'help-more' };

/** The screens with a help button (P07-05), in tab order and then the rest. */
export const helpScreens = ['shelf', 'scan', 'loans', 'groups', 'settings', 'book', 'editions', 'series'] as const;
export type HelpScreen = (typeof helpScreens)[number];

function help(screen: HelpScreen, text: MessageKey): TipDef {
  return tip({ id: `help-${screen}`, trigger: 'help-requested', when: { screen }, expression: 'thinking', text, action: more, priority: 100, frequency: 'always', modes: both, kind: 'help', screenBound: true });
}

export const tips: readonly TipDef[] = [
  // First launch: the onboarding's first card says it.
  tip({
    id: 'welcome',
    trigger: 'app-first-launch',
    expression: 'happy',
    text: 'tips.welcome.text',
    priority: 100,
    frequency: 'once',
    modes: both,
    kind: 'nudge',
    placement: 'onboarding',
  }),
  tip({
    id: 'shelf-empty',
    trigger: 'shelf-empty',
    expression: 'happy',
    text: 'tips.shelfEmpty.text',
    priority: 30,
    frequency: 'session',
    modes: both,
    kind: 'nudge',
    screenBound: true,
    welcome: true,
  }),
  tip({
    id: 'scan-first-visit',
    trigger: 'scan-opened',
    expression: 'thinking',
    text: 'tips.scanFirstVisit.text',
    priority: 40,
    frequency: 'once',
    modes: helpfulOnly,
    kind: 'nudge',
    screenBound: true,
    welcome: true,
  }),
  tip({
    id: 'scan-idle',
    trigger: 'scan-idle',
    expression: 'thinking',
    text: 'tips.scanIdle.text',
    action: { label: 'tips.actions.readCover', id: 'read-cover' },
    priority: 40,
    frequency: 'session',
    modes: helpfulOnly,
    kind: 'nudge',
    placement: 'inline',
  }),
  // Lookups that found nothing are shown in place, where the user is looking, in every mode.
  tip({
    id: 'lookup-none',
    trigger: 'lookup-none',
    expression: 'concerned',
    text: 'tips.lookupNone.text',
    priority: 80,
    frequency: 'always',
    modes: both,
    kind: 'feedback',
    placement: 'inline',
  }),
  tip({
    id: 'lookup-none-scan',
    trigger: 'lookup-none',
    when: { variant: 'scan' },
    expression: 'concerned',
    text: 'tips.lookupNoneScan.text',
    priority: 80,
    frequency: 'always',
    modes: both,
    kind: 'feedback',
    placement: 'inline',
  }),
  tip({
    id: 'lookup-gave-up',
    trigger: 'lookup-none',
    when: { variant: 'offline' },
    expression: 'concerned',
    text: 'tips.lookupGaveUp.text',
    priority: 55,
    frequency: 'always',
    modes: both,
    kind: 'feedback',
    sample: { books: '12 books', them: 'them' },
  }),
  tip({
    id: 'lookup-arrived',
    trigger: 'lookup-arrived',
    expression: 'excited',
    text: 'tips.lookupArrived.text',
    priority: 55,
    frequency: 'always',
    modes: helpfulOnly,
    kind: 'feedback',
    sample: { books: '12 books' },
  }),
  tip({
    id: 'book-added',
    trigger: 'book-added',
    expression: 'excited',
    text: 'tips.bookAdded.text',
    priority: 50,
    frequency: 'always',
    minIntervalMs: 10_000,
    modes: helpfulOnly,
    kind: 'feedback',
    sample: { books: '1,234 books' },
  }),
  tip({
    id: 'book-added-milestone',
    trigger: 'book-added',
    when: { variant: 'milestone' },
    expression: 'excited',
    text: 'tips.bookAddedMilestone.text',
    priority: 52,
    frequency: 'always',
    minIntervalMs: 10_000,
    modes: helpfulOnly,
    kind: 'feedback',
    sample: { books: '1,000 books' },
  }),
  tip({
    id: 'book-added-batch',
    trigger: 'book-added',
    when: { variant: 'batch' },
    expression: 'excited',
    text: 'tips.bookAddedBatch.text',
    priority: 50,
    frequency: 'always',
    modes: helpfulOnly,
    kind: 'feedback',
    sample: { saved: '25 books', books: '1,234 books' },
  }),
  tip({
    id: 'offline-queued',
    trigger: 'offline-queued',
    expression: 'sleepy',
    text: 'tips.offlineQueued.text',
    priority: 60,
    frequency: 'always',
    modes: both,
    kind: 'feedback',
  }),
  tip({
    id: 'loan-overdue',
    trigger: 'loan-overdue',
    expression: 'concerned',
    title: 'tips.loanOverdue.title',
    text: 'tips.loanOverdue.text',
    action: { label: 'tips.actions.openLoans', href: '/loans' },
    priority: 60,
    frequency: 'daily',
    modes: helpfulOnly,
    kind: 'nudge',
    screenBound: true,
    sample: { title: 'The Curious Incident of the Dog in the Night-Time', borrower: 'Alexandra', when: '12 days ago' },
  }),
  tip({
    id: 'series-gap',
    trigger: 'series-gap',
    expression: 'thinking',
    text: 'tips.seriesGap.text',
    action: { label: 'tips.actions.seeSeries', href: '/series/{seriesId}' },
    priority: 70,
    frequency: 'once',
    modes: helpfulOnly,
    kind: 'nudge',
    testGroup: 'seriesTip',
    sample: { have: 'You have #1, #2, #4 and #6 of A Series of Unfortunate Events', missing: '#3 and #5 are missing.', seriesId: 12 },
  }),
  tip({
    id: 'series-complete',
    trigger: 'series-complete',
    expression: 'excited',
    title: 'tips.seriesComplete.title',
    text: 'tips.seriesComplete.text',
    action: { label: 'tips.actions.seeSeries', href: '/series/{seriesId}' },
    priority: 90,
    frequency: 'always',
    modes: both,
    kind: 'feedback',
    celebration: true,
    testGroup: 'seriesCelebration',
    sample: { whole: 'All 13 A Series of Unfortunate Events books', seriesId: 12 },
  }),
  tip({
    id: 'backup-due',
    trigger: 'backup-due',
    expression: 'concerned',
    title: 'tips.backupDue.title',
    text: 'tips.backupDue.text',
    action: { label: 'tips.actions.backUp', href: '/settings/backup' },
    secondary: { label: 'tips.actions.later', id: 'backup-later' },
    priority: 20,
    // The backup rule (P08-06) caps it at once a week and honours "Later"; Quiet still shows it,
    // since losing a library is the one thing worth interrupting for.
    frequency: 'always',
    modes: both,
    kind: 'nudge',
    screenBound: true,
  }),
  // Help buttons (P07-05): one tip per screen; "More help" opens the help sheet.
  tip({
    id: 'help-booky',
    trigger: 'help-requested',
    when: { screen: 'booky' },
    expression: 'excited',
    title: 'tips.helpBooky.title',
    text: 'tips.helpBooky.text',
    priority: 100,
    frequency: 'always',
    modes: both,
    kind: 'help',
  }),
  help('shelf', 'tips.help.shelf'),
  help('scan', 'tips.help.scan'),
  help('loans', 'tips.help.loans'),
  help('groups', 'tips.help.groups'),
  help('settings', 'tips.help.settings'),
  help('book', 'tips.help.book'),
  help('editions', 'tips.help.editions'),
  help('series', 'tips.help.series'),
];

const byId = new Map(tips.map((t) => [t.id, t]));

/** A tip by id; throws for an unknown id (a typo in code, caught by tests). */
export function tipById(id: string): TipDef {
  const tip = byId.get(id);
  if (!tip) throw new Error(`Booky has no tip "${id}"`);
  return tip;
}
