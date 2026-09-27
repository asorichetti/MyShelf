import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { isBlocked } from '@/components/ui/layers';
import { today as todayOf, type BookyMode } from '@/domain';

import { subscribeBooky, type BookyEmission } from './bus';
import {
  initialEngineState,
  markDismissed,
  markShown,
  mute as muteIn,
  resetTips as resetIn,
  selectFirst,
  type BookyEvent,
  type EngineState,
  type SelectedTip,
} from './engine';
import { topicOnScreen } from './topics';

/** What Booky remembers between sessions (the app keeps it in `settings`). */
export interface BookyStoreData {
  mode: BookyMode;
  muted: string[];
  seen: string[];
  /** First-run guidance (welcome tips) is on. */
  welcome: boolean;
}

/** Where Booky's memory lives. The app passes one backed by the settings table; tests may pass none. */
export interface BookyStore {
  load: () => Promise<BookyStoreData>;
  save: (patch: Partial<Pick<BookyStoreData, 'mode' | 'muted' | 'seen'>>) => Promise<void>;
}

/** A tip on its way to the screen. */
export interface ShownTip extends SelectedTip {
  /** Unique per showing, so the same tip shown twice is a new bubble (and a new announcement). */
  showId: number;
}

/** The help sheet (P07-05): which screen's help is open. */
export interface HelpRequest {
  screen: string;
}

export interface BookyContextValue {
  /** The tip floating over the app (inline tips are drawn by their screens). */
  tip: ShownTip | null;
  mode: BookyMode;
  /** Counts reloads of Booky's memory; effects that emit may depend on it to try again with fresh settings. */
  memoryVersion: number;
  /** Sends an event (or alternatives) to the engine; resolves to the tip shown, if any. */
  emit: (emission: BookyEmission) => Promise<ShownTip | null>;
  dismissTip: () => void;
  /** "Don't show tips like this": mutes the tip (default: the one showing) and puts it away. */
  muteTip: (tipId?: string) => void;
  setMode: (mode: BookyMode) => void;
  /** Clears what Booky has shown and muted. */
  resetTips: () => void;
  /** Puts the tip away and runs its action if that has an id (`help-more`). */
  runAction: (tip: ShownTip, id?: string) => void;
  help: HelpRequest | null;
  openHelp: (screen: string) => void;
  closeHelp: () => void;
}

const BookyContext = createContext<BookyContextValue | null>(null);

/** What the engine made of one emission: the triggers it was sent and the tip it chose (null: none). */
export interface BookyDecision {
  triggers: BookyEvent['type'][];
  tip: string | null;
}

export interface BookyProviderProps {
  children: ReactNode;
  store?: BookyStore;
  /** Bump to reload from the store (settings changed underneath, e.g. an E2E fixture). */
  reloadKey?: number;
  /** Clock and calendar, for tests. */
  now?: () => number;
  today?: () => string;
  /** Told of every decision, tip or not (the web E2E build notes them for journeys). */
  onDecision?: (decision: BookyDecision) => void;
}

/** Holds Booky's state, runs the engine for every event and remembers what was shown. */
export function BookyProvider({ children, store, reloadKey = 0, now = Date.now, today = todayOf, onDecision }: BookyProviderProps) {
  const engine = useRef<EngineState>(initialEngineState(today()));
  const [tip, setTip] = useState<ShownTip | null>(null);
  const [mode, setModeState] = useState<BookyMode>('helpful');
  const [help, setHelp] = useState<HelpRequest | null>(null);
  const [memoryVersion, setMemoryVersion] = useState(0);
  const nextShowId = useRef(1);
  const loaded = useRef<Promise<void>>(Promise.resolve());
  // Saves run one after another, and a reload waits for them, so it never reads stale memory.
  const saving = useRef<Promise<void>>(Promise.resolve());
  const clock = useRef({ now, today });
  const decided = useRef(onDecision);
  useEffect(() => {
    clock.current = { now, today };
    decided.current = onDecision;
  }, [now, today, onDecision]);

  useEffect(() => {
    if (!store) return;
    let active = true;
    loaded.current = saving.current
      .then(() => store.load())
      .then((data) => {
        if (!active) return;
        engine.current = { ...engine.current, mode: data.mode, muted: data.muted, seen: data.seen, welcome: data.welcome };
        setModeState(data.mode);
        setMemoryVersion((v) => v + 1);
      })
      .catch((e) => console.warn('Booky could not read its settings', e));
    return () => {
      active = false;
    };
  }, [store, reloadKey]);

  const persist = useCallback(
    (patch: Parameters<BookyStore['save']>[0]) => {
      if (!store) return;
      saving.current = saving.current.then(() => store.save(patch)).catch((e) => console.warn('Booky could not save its settings', e));
    },
    [store],
  );

  const dismissTip = useCallback(() => {
    engine.current = markDismissed(engine.current);
    setTip(null);
  }, []);

  const openHelp = useCallback((screen: string) => setHelp({ screen }), []);
  const closeHelp = useCallback(() => setHelp(null), []);

  const emit = useCallback(
    async (emission: BookyEmission): Promise<ShownTip | null> => {
      await loaded.current;
      const sent: readonly BookyEvent[] = Array.isArray(emission) ? emission : [emission as BookyEvent];
      // A tip about what the screen in front already shows is not floated over it (it stays unused, for later).
      const events = sent.filter((e) => !topicOnScreen(e.topics));
      const t = clock.current.now();
      const state = { ...engine.current, blocked: isBlocked(), today: clock.current.today() };
      const chosen = selectFirst(state, events, t);
      decided.current?.({ triggers: sent.map((e) => e.type), tip: chosen?.tip.id ?? null });
      if (!chosen) return null;
      const next = markShown(state, chosen, t);
      if (next.seen !== state.seen) persist({ seen: [...next.seen] });
      engine.current = next;
      const shown: ShownTip = { ...chosen, showId: nextShowId.current++ };
      if ((chosen.tip.placement ?? 'overlay') !== 'overlay') return shown;
      // Off: help comes without the character, straight to the help sheet.
      if (state.mode === 'off' && chosen.tip.kind === 'help') {
        engine.current = markDismissed(engine.current);
        const more = chosen.event.handlers?.['help-more'];
        if (more) more();
        else if (chosen.event.screen && chosen.action?.id === 'help-more') openHelp(chosen.event.screen);
        return shown;
      }
      setTip(shown);
      return shown;
    },
    [persist, openHelp],
  );

  useEffect(() => subscribeBooky((emission) => void emit(emission)), [emit]);

  const muteTip = useCallback(
    (tipId?: string) => {
      const id = tipId ?? tip?.tip.id;
      if (!id) return;
      engine.current = muteIn(engine.current, id);
      persist({ muted: [...engine.current.muted] });
      if (tip?.tip.id === id) dismissTip();
    },
    [tip, persist, dismissTip],
  );

  const setMode = useCallback(
    (next: BookyMode) => {
      engine.current = { ...engine.current, mode: next };
      setModeState(next);
      persist({ mode: next });
      if (next === 'off') dismissTip();
    },
    [persist, dismissTip],
  );

  const resetTips = useCallback(() => {
    engine.current = resetIn(engine.current);
    persist({ seen: [], muted: [] });
  }, [persist]);

  const runAction = useCallback(
    (shown: ShownTip, actionId?: string) => {
      const id = actionId ?? shown.action?.id;
      dismissTip();
      if (!id) return;
      const handler = shown.event.handlers?.[id];
      if (handler) handler();
      else if (id === 'help-more' && shown.event.screen) openHelp(shown.event.screen);
    },
    [dismissTip, openHelp],
  );

  const value = useMemo(
    () => ({ tip, mode, memoryVersion, emit, dismissTip, muteTip, setMode, resetTips, runAction, help, openHelp, closeHelp }),
    [tip, mode, memoryVersion, emit, dismissTip, muteTip, setMode, resetTips, runAction, help, openHelp, closeHelp],
  );
  return <BookyContext.Provider value={value}>{children}</BookyContext.Provider>;
}

/** Booky's state and controls, from anywhere below a BookyProvider. */
export function useBooky(): BookyContextValue {
  const ctx = useContext(BookyContext);
  if (!ctx) throw new Error('useBooky must be used inside a BookyProvider');
  return ctx;
}

/** Like useBooky, but null outside a provider (components that also render on their own, e.g. in tests). */
export function useOptionalBooky(): BookyContextValue | null {
  return useContext(BookyContext);
}

/** Booky's mode; Helpful outside a provider. */
export function useBookyMode(): BookyMode {
  return useContext(BookyContext)?.mode ?? 'helpful';
}
