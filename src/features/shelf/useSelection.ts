import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';

export interface Selection {
  /** True while the screen is in selection mode (even with nothing picked yet). */
  selecting: boolean;
  /** Picked ids, in the order they were picked. */
  ids: number[];
  count: number;
  isSelected: (id: number) => boolean;
  /** Enters selection mode, optionally picking a first book (a long press). */
  start: (id?: number) => void;
  toggle: (id: number) => void;
  /** Leaves selection mode and forgets the picks. */
  exit: () => void;
}

/**
 * Multi-select state for a list of books. While selecting, Android's back
 * button leaves selection mode instead of leaving the screen.
 */
export function useSelection(initiallySelecting = false): Selection {
  const [selecting, setSelecting] = useState(initiallySelecting);
  const [ids, setIds] = useState<number[]>([]);

  const start = useCallback((id?: number) => {
    setSelecting(true);
    if (id != null) setIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);
  const toggle = useCallback((id: number) => setIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id])), []);
  const exit = useCallback(() => {
    setSelecting(false);
    setIds([]);
  }, []);

  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exit();
      return true;
    });
    return () => sub.remove();
  }, [selecting, exit]);

  const set = useMemo(() => new Set(ids), [ids]);
  const isSelected = useCallback((id: number) => set.has(id), [set]);
  return { selecting, ids, count: ids.length, isSelected, start, toggle, exit };
}
