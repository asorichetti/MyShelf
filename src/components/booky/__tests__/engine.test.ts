import {
  blockedReason,
  candidatesFor,
  initialEngineState,
  markDismissed,
  markShown,
  mute,
  NUDGE_COOLDOWN_MS,
  resetTips,
  selectFirst,
  selectTip,
  type BookyEvent,
  type EngineState,
} from '../engine';
import { tipById } from '../tips';

const TODAY = '2026-06-15';
const state = (patch: Partial<EngineState> = {}) => initialEngineState(TODAY, patch);
const gap: BookyEvent = { type: 'series-gap', key: 3, vars: { have: 'You have #1 and #3 of Discworld', missing: '#2 is missing.', seriesId: 3 } };
const overdue = (key: number): BookyEvent => ({ type: 'loan-overdue', key, vars: { title: 'Dune', borrower: 'Sam', when: '3 days ago' } });
const added: BookyEvent = { type: 'book-added', vars: { books: '12 books' } };
const help = (screen: string): BookyEvent => ({ type: 'help-requested', screen });

describe('selectTip: which tip for which event', () => {
  it.each<[string, BookyEvent, string | null]>([
    ['shelf empty', { type: 'shelf-empty' }, 'shelf-empty'],
    ['first visit to Scan', { type: 'scan-opened' }, 'scan-first-visit'],
    ['book added', added, 'book-added'],
    ['book added, milestone', { ...added, variant: 'milestone' }, 'book-added-milestone'],
    ['book added, batch', { type: 'book-added', variant: 'batch', vars: { saved: '2 books', books: '12 books' } }, 'book-added-batch'],
    ['book added, unknown variant falls back', { ...added, variant: 'nope' }, 'book-added'],
    ['lookup none (offline gave up)', { type: 'lookup-none', variant: 'offline', vars: { books: '1 book', them: 'it' } }, 'lookup-gave-up'],
    ['help on the Shelf', help('shelf'), 'help-shelf'],
    ['help on an unknown screen', help('nowhere'), null],
    ['app foreground (no tip of its own)', { type: 'app-foreground' }, null],
    ['series gap', gap, 'series-gap'],
    ['overdue loan', overdue(1), 'loan-overdue'],
  ])('%s', (_, event, id) => {
    expect(selectTip(state(), event, 0)?.tip.id ?? null).toBe(id);
  });

  it('fills the text, the title and the action', () => {
    expect(selectTip(state(), gap, 0)).toMatchObject({
      key: 'series-gap:3',
      text: 'You have #1 and #3 of Discworld — #2 is missing.',
      action: { label: 'See the series', href: '/series/3' },
    });
    expect(selectTip(state(), help('scan'), 0)).toMatchObject({ key: 'help-scan', action: { label: 'More help', id: 'help-more' } });
  });

  it('is deterministic', () => {
    const s = state({ seen: ['x'], lastShown: { 'book-added': 5 } });
    expect(selectTip(s, added, 20_000)).toEqual(selectTip(s, added, 20_000));
  });

  it('keeps help screens apart', () => {
    expect(candidatesFor(help('scan')).map((t) => t.id)).toEqual(['help-scan']);
  });
});

describe('modes', () => {
  it.each<[EngineState['mode'], BookyEvent, boolean]>([
    ['helpful', added, true],
    ['quiet', added, false],
    ['off', added, false],
    ['helpful', gap, true],
    ['quiet', gap, false],
    ['quiet', { type: 'shelf-empty' }, true],
    ['off', { type: 'shelf-empty' }, false],
    ['quiet', { type: 'offline-queued' }, true],
    ['quiet', { type: 'series-complete', key: 1, vars: { whole: 'All 3 Earthsea books', seriesId: 1 } }, true],
    ['off', { type: 'series-complete', key: 1, vars: { whole: 'All 3 Earthsea books', seriesId: 1 } }, false],
    ['helpful', help('loans'), true],
    ['quiet', help('loans'), true],
    ['off', help('loans'), true],
  ])('%s mode, %j -> shows: %s', (mode, event, shows) => {
    expect(selectTip(state({ mode }), event, 0) != null).toBe(shows);
  });
});

describe('frequency', () => {
  it('once: never again for the same key, but again for another key', () => {
    const s = markDismissed(markShown(state(), selectTip(state(), gap, 0)!, 0));
    expect(s.seen).toEqual(['series-gap:3']);
    expect(selectTip(s, gap, 10 * NUDGE_COOLDOWN_MS)).toBeNull();
    expect(selectTip(s, { ...gap, key: 4 }, 10 * NUDGE_COOLDOWN_MS)?.key).toBe('series-gap:4');
  });

  it('session: once per app session, not remembered across sessions', () => {
    const s = markDismissed(markShown(state(), selectTip(state(), { type: 'shelf-empty' }, 0)!, 0));
    expect(s.seen).toEqual([]);
    expect(selectTip(s, { type: 'shelf-empty' }, 10 * NUDGE_COOLDOWN_MS)).toBeNull();
    expect(selectTip({ ...s, session: [] }, { type: 'shelf-empty' }, 10 * NUDGE_COOLDOWN_MS)).not.toBeNull();
  });

  it('daily: once a day per key, and only today’s entries are kept', () => {
    const old = state({ seen: ['loan-overdue:1@2026-06-14', 'series-gap:3'] });
    const s = markDismissed(markShown(old, selectTip(old, overdue(1), 0)!, 0));
    expect(s.seen).toEqual(['series-gap:3', 'loan-overdue:1@2026-06-15']);
    expect(selectTip(s, overdue(1), 10 * NUDGE_COOLDOWN_MS)).toBeNull();
    expect(selectTip({ ...s, today: '2026-06-16' }, overdue(1), 10 * NUDGE_COOLDOWN_MS)).not.toBeNull();
  });

  it('always, with a minimum interval: "Shelved!" at most once per 10 s', () => {
    const s = markDismissed(markShown(state(), selectTip(state(), added, 0)!, 0));
    expect(blockedReason(s, tipById('book-added'), added, 9_999)).toBe('shown too recently');
    expect(selectTip(s, added, 10_000)?.tip.id).toBe('book-added');
  });

  it('help is always available', () => {
    let s = state();
    for (let i = 0; i < 3; i++) {
      const tip = selectTip(s, help('shelf'), i)!;
      expect(tip.tip.id).toBe('help-shelf');
      s = markShown(s, tip, i);
    }
  });
});

describe('cooldown, dialogs and what is on screen', () => {
  it('one nudge per 30 s, unless the next one outranks it', () => {
    const shelf = selectTip(state(), { type: 'shelf-empty' }, 0)!;
    const s = markDismissed(markShown(state(), shelf, 0));
    expect(blockedReason(s, tipById('scan-first-visit'), { type: 'scan-opened' }, 10_000)).toBeNull(); // 40 > 30
    const scan = markDismissed(markShown(s, selectTip(s, { type: 'scan-opened' }, 10_000)!, 10_000));
    expect(selectTip(scan, { type: 'shelf-empty' }, 20_000)).toBeNull();
    expect(blockedReason({ ...scan, session: [] }, tipById('shelf-empty'), { type: 'shelf-empty' }, 20_000)).toBe('cooling down');
    expect(selectTip({ ...scan, session: [] }, { type: 'shelf-empty' }, 10_000 + NUDGE_COOLDOWN_MS)).not.toBeNull();
  });

  it('replies to the user are not held back by the cooldown', () => {
    const s = markShown(state(), selectTip(state(), { type: 'shelf-empty' }, 0)!, 0);
    expect(selectTip(markDismissed(s), added, 1)?.tip.id).toBe('book-added');
  });

  it('no nudge while a dialog or sheet is open; feedback and help still come', () => {
    const s = state({ blocked: true });
    expect(blockedReason(s, tipById('series-gap'), gap, 0)).toBe('a dialog is open');
    expect(selectTip(s, added, 0)).not.toBeNull();
    expect(selectTip(s, help('shelf'), 0)).not.toBeNull();
  });

  it('never replaces a more important tip, except with help', () => {
    const celebration = selectTip(state(), { type: 'series-complete', key: 1, vars: { whole: 'All 3', seriesId: 1 } }, 0)!;
    const s = markShown(state(), celebration, 0);
    expect(selectTip(s, gap, 1)).toBeNull();
    expect(selectTip(s, help('series'), 1)?.tip.id).toBe('help-series');
    // A more important one does replace a lesser one.
    const t = markShown(state(), selectTip(state(), added, 0)!, 0);
    expect(selectTip(t, gap, 1)?.tip.id).toBe('series-gap');
  });

  it('inline tips do not count as the one on screen', () => {
    const s = markShown(state(), selectTip(state(), { type: 'scan-idle' }, 0)!, 0);
    expect(s.current).toBeNull();
    expect(s.session).toEqual(['scan-idle']);
  });
});

describe('mute, welcome tips and reset', () => {
  it('a muted tip never shows; help cannot be muted', () => {
    expect(selectTip(mute(state(), 'book-added'), added, 0)).toBeNull();
    expect(selectTip(mute(state(), 'help-shelf'), help('shelf'), 0)).not.toBeNull();
    expect(mute(mute(state(), 'a'), 'a').muted).toEqual(['a']);
  });

  it('welcome tips wait for first-run guidance', () => {
    expect(blockedReason(state({ welcome: false }), tipById('shelf-empty'), { type: 'shelf-empty' }, 0)).toBe('first-run guidance is off');
    expect(selectTip(state({ welcome: false }), added, 0)).not.toBeNull();
  });

  it('reset clears what was seen and muted', () => {
    const s = resetTips(state({ seen: ['series-gap:3'], muted: ['book-added'], session: ['shelf-empty'], lastNudge: { at: 1, priority: 1 } }));
    expect(s).toMatchObject({ seen: [], muted: [], session: [], lastNudge: null, lastShown: {} });
  });
});

describe('backup reminder (P08-06 on the engine)', () => {
  it('shows in Helpful and Quiet with "Back up" and "Later", not when off or muted', () => {
    const backup: BookyEvent = { type: 'backup-due' };
    expect(selectTip(state({ mode: 'quiet' }), backup, 0)).toMatchObject({
      title: 'A little safety net',
      action: { label: 'Back up', href: '/settings/backup' },
      secondary: { label: 'Later', id: 'backup-later' },
    });
    expect(selectTip(state({ mode: 'off' }), backup, 0)).toBeNull();
    expect(selectTip(state({ muted: ['backup-due'] }), backup, 0)).toBeNull();
  });
});

describe('selectFirst', () => {
  it('takes the first alternative with something to say', () => {
    const s = state({ seen: ['loan-overdue:1@2026-06-15'] });
    expect(selectFirst(s, [overdue(1), overdue(2)], 0)?.key).toBe('loan-overdue:2');
    expect(selectFirst(s, [overdue(1)], 0)).toBeNull();
    expect(selectFirst(s, [], 0)).toBeNull();
  });
});
