import { formatTip, type TipVars } from './format';
import { tips as catalogue, type BookyTrigger, type TipDef } from './tips';

/**
 * Booky's rules engine (P07-02). Pure: given what Booky knows (`EngineState`),
 * an event and the time, `selectTip` says which tip to show, if any, and
 * `markShown` records that it was shown. `BookyProvider` holds the state,
 * persists the parts that outlive a session and renders the result.
 *
 * The rules, in order:
 * 1. Only tips for the event's trigger (and its `when`: help screen or variant).
 * 2. Mode: Off shows only help; Quiet only tips that list `quiet`.
 * 3. Muted tips ("Don't show tips like this") never show.
 * 4. Welcome tips only while first-run guidance is on.
 * 5. Frequency: once (per key), once a session, once a day (per key), always;
 *    and `minIntervalMs` between two showings.
 * 6. Nudges (unprompted) never show while a dialog or sheet is open, and at
 *    most one per 30 s unless it outranks the last one.
 * 7. Nothing replaces a tip of higher priority on screen, except help.
 * 8. Of what is left, the highest priority wins; ties go to catalogue order.
 */

/** No more than one unprompted tip per this many milliseconds. */
export const NUDGE_COOLDOWN_MS = 30_000;

export type EngineMode = 'helpful' | 'quiet' | 'off';

export interface EngineState {
  mode: EngineMode;
  /** Muted tip ids (or one tip instance, `<id>:<key>`). */
  muted: readonly string[];
  /** Persisted: `<id>[:<key>]` for once-only tips, `<id>[:<key>]@<YYYY-MM-DD>` for once-a-day ones. */
  seen: readonly string[];
  /** Tip keys shown in this app session. */
  session: readonly string[];
  /** When each tip id last showed (ms). */
  lastShown: Readonly<Record<string, number>>;
  /** The last nudge shown, for the cooldown. */
  lastNudge: { at: number; priority: number } | null;
  /** The tip on screen now. */
  current: { id: string; priority: number } | null;
  /** A dialog or sheet is open. */
  blocked: boolean;
  /** First-run guidance (welcome tips) is on. */
  welcome: boolean;
  /** Today, YYYY-MM-DD, for once-a-day tips. */
  today: string;
}

export const initialEngineState = (today: string, overrides: Partial<EngineState> = {}): EngineState => ({
  mode: 'helpful',
  muted: [],
  seen: [],
  session: [],
  lastShown: {},
  lastNudge: null,
  current: null,
  blocked: false,
  welcome: true,
  today,
  ...overrides,
});

export interface BookyEvent {
  type: BookyTrigger;
  /** Help screen id (`help-requested`). */
  screen?: string;
  /** Picks a variant of the trigger's tip (`batch`, `milestone`, …). */
  variant?: string;
  /** Identifies the instance for once/daily tips: the series id, the loan id. */
  key?: string | number;
  /** Placeholder values. */
  vars?: TipVars;
  /** Handlers for the tip's action ids (`read-cover`, or a screen's own `help-more`). */
  handlers?: Readonly<Record<string, () => void>>;
}

/** A tip chosen for an event, with its text filled in. */
export interface SelectedTip {
  tip: TipDef;
  /** `<id>` or `<id>:<key>`: what the frequency and the mute list count. */
  key: string;
  text: string;
  title?: string;
  action?: { label: string; href?: string; id?: string };
  secondary?: { label: string; href?: string; id?: string };
  event: BookyEvent;
}

const instanceKey = (tip: TipDef, event: BookyEvent) => (event.key == null ? tip.id : `${tip.id}:${event.key}`);
const dailyKey = (key: string, today: string) => `${key}@${today}`;

/** The catalogue's tips for an event: those matching its variant, else the trigger's plain tips. */
export function candidatesFor(event: BookyEvent, tips: readonly TipDef[] = catalogue): TipDef[] {
  const forTrigger = tips.filter((t) => t.trigger === event.type && (event.type !== 'help-requested' || t.when?.screen === event.screen));
  if (event.type === 'help-requested') return forTrigger;
  const variant = forTrigger.filter((t) => event.variant != null && t.when?.variant === event.variant);
  return variant.length ? variant : forTrigger.filter((t) => t.when?.variant == null);
}

/** Why a tip would not show now, or null when it may. (Exported for the tests' messages.) */
export function blockedReason(state: EngineState, tip: TipDef, event: BookyEvent, now: number): string | null {
  const key = instanceKey(tip, event);
  if (tip.kind !== 'help') {
    if (state.mode === 'off') return 'Booky is off';
    if (!tip.modes.includes(state.mode)) return `not in ${state.mode} mode`;
  }
  if (tip.kind !== 'help' && (state.muted.includes(tip.id) || state.muted.includes(key))) return 'muted';
  if (tip.welcome && !state.welcome) return 'first-run guidance is off';
  if (tip.frequency === 'once' && state.seen.includes(key)) return 'already shown';
  if (tip.frequency === 'daily' && state.seen.includes(dailyKey(key, state.today))) return 'already shown today';
  if (tip.frequency === 'session' && state.session.includes(key)) return 'already shown this session';
  const last = state.lastShown[tip.id];
  if (tip.minIntervalMs != null && last != null && now - last < tip.minIntervalMs) return 'shown too recently';
  if (tip.kind === 'nudge') {
    if (state.blocked) return 'a dialog is open';
    if (state.lastNudge && now - state.lastNudge.at < NUDGE_COOLDOWN_MS && tip.priority <= state.lastNudge.priority) return 'cooling down';
  }
  if (tip.kind !== 'help' && state.current && state.current.priority > tip.priority) return 'a more important tip is showing';
  return null;
}

function fill(tip: TipDef, event: BookyEvent): SelectedTip {
  const vars = event.vars ?? {};
  const fillAction = (a: TipDef['action']) => a && ('href' in a ? { label: a.label, href: formatTip(a.href, vars) } : { label: a.label, id: a.id });
  return { tip, key: instanceKey(tip, event), text: formatTip(tip.text, vars), title: tip.title, action: fillAction(tip.action), secondary: fillAction(tip.secondary), event };
}

/** The tip to show for `event` now, or null. Deterministic for a given state, event and time. */
export function selectTip(state: EngineState, event: BookyEvent, now: number, tips: readonly TipDef[] = catalogue): SelectedTip | null {
  const eligible = candidatesFor(event, tips).filter((tip) => blockedReason(state, tip, event, now) == null);
  if (!eligible.length) return null;
  // A stable sort keeps catalogue order for equal priorities.
  const best = [...eligible].sort((a, b) => b.priority - a.priority)[0];
  return fill(best, event);
}

/** The first of several alternative events (in preference order) that has a tip to show. */
export function selectFirst(state: EngineState, events: readonly BookyEvent[], now: number, tips: readonly TipDef[] = catalogue): SelectedTip | null {
  for (const event of events) {
    const chosen = selectTip(state, event, now, tips);
    if (chosen) return chosen;
  }
  return null;
}

/** State after `chosen` was shown: frequency and cooldown bookkeeping. */
export function markShown(state: EngineState, chosen: SelectedTip, now: number): EngineState {
  const { tip, key } = chosen;
  let seen = state.seen;
  if (tip.frequency === 'once' && !seen.includes(key)) seen = [...seen, key];
  if (tip.frequency === 'daily') {
    // Only today's entries are worth keeping, so the list never grows.
    seen = [...seen.filter((s) => !s.includes('@') || s.endsWith(`@${state.today}`)), dailyKey(key, state.today)];
    seen = [...new Set(seen)];
  }
  return {
    ...state,
    seen,
    session: state.session.includes(key) ? state.session : [...state.session, key],
    lastShown: { ...state.lastShown, [tip.id]: now },
    lastNudge: tip.kind === 'nudge' ? { at: now, priority: tip.priority } : state.lastNudge,
    current: tip.placement === 'inline' ? state.current : { id: tip.id, priority: tip.priority },
  };
}

/** The tip on screen went away. */
export const markDismissed = (state: EngineState): EngineState => ({ ...state, current: null });

/** "Don't show tips like this": mutes the tip's id (every instance of it). */
export const mute = (state: EngineState, tipId: string): EngineState =>
  state.muted.includes(tipId) ? state : { ...state, muted: [...state.muted, tipId] };

/** Settings → Booky → "Reset tips": every tip can show again. */
export const resetTips = (state: EngineState): EngineState => ({ ...state, seen: [], muted: [], session: [], lastShown: {}, lastNudge: null });
