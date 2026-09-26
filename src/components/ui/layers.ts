import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Dimensions, type LayoutChangeEvent, type View } from 'react-native';

/**
 * What is on screen above the content, for anything that floats (Booky's
 * tips, P07-07) and must stay out of the way:
 *
 * - blocking layers: dialogs, sheets and menus. While one is open nothing
 *   unprompted may appear.
 * - bottom obstacles: things anchored near the bottom edge that must stay
 *   uncovered: the Shelf's Add book button, the selection bar, the snackbar.
 *   Each is measured in window coordinates.
 *
 * A module-level store (no provider): Sheet, ConfirmDialog and friends
 * register themselves wherever they are rendered.
 */

/** A bottom obstacle's box, in window coordinates (px). */
export interface ObstacleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayersSnapshot {
  blocking: number;
  obstacles: readonly ObstacleRect[];
}

let nextId = 1;
const blocking = new Set<number>();
const obstacles = new Map<number, ObstacleRect>();
const listeners = new Set<() => void>();
let snapshot: LayersSnapshot = { blocking: 0, obstacles: [] };

function changed() {
  snapshot = { blocking: blocking.size, obstacles: [...obstacles.values()] };
  for (const l of [...listeners]) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getLayers = (): LayersSnapshot => snapshot;

/** Whether a dialog, sheet or menu is open right now. */
export const isBlocked = (): boolean => blocking.size > 0;

/** Re-renders when layers come and go. */
export function useLayers(): LayersSnapshot {
  return useSyncExternalStore(subscribe, getLayers, getLayers);
}

/** Calls `listener` whenever layers change; returns the unsubscribe function. */
export const subscribeLayers = subscribe;

/** Registers a dialog, sheet or menu as open while `open` is true. */
export function useBlockingLayer(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    const id = nextId++;
    blocking.add(id);
    changed();
    return () => {
      blocking.delete(id);
      changed();
    };
  }, [open]);
}

/**
 * Registers a bottom obstacle while `active`. Pass `attach` as the `ref` of
 * the obstacle's outer view, with `onLayout`; it is measured in the window on
 * every layout (so a resize or a slide is followed).
 */
export function useBottomObstacle(active = true): { attach: (view: View | null) => void; onLayout: (e?: LayoutChangeEvent) => void } {
  const node = useRef<View | null>(null);
  const attach = useCallback((view: View | null) => {
    node.current = view;
  }, []);
  const [id] = useState(() => nextId++);
  const live = useRef(active);
  useEffect(() => {
    live.current = active;
  }, [active]);
  const onLayout = useCallback(() => {
    const view = node.current;
    if (!live.current || !view?.measureInWindow) return;
    view.measureInWindow((x, y, width, height) => {
      if (!live.current || ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
      const prev = obstacles.get(id);
      if (prev && prev.x === x && prev.y === y && prev.width === width && prev.height === height) return;
      obstacles.set(id, { x, y, width, height });
      changed();
    });
  }, [id]);

  useEffect(() => {
    if (!active) return;
    onLayout();
    const sub = Dimensions.addEventListener('change', () => onLayout());
    return () => {
      sub.remove();
      if (obstacles.delete(id)) changed();
    };
  }, [active, id, onLayout]);

  return { attach, onLayout };
}

/** Tests: forget everything. */
export function resetLayers(): void {
  blocking.clear();
  obstacles.clear();
  changed();
}

/** Tests: add an obstacle by hand; returns its remover. */
export function addObstacleForTest(rect: ObstacleRect): () => void {
  const id = nextId++;
  obstacles.set(id, rect);
  changed();
  return () => {
    obstacles.delete(id);
    changed();
  };
}
