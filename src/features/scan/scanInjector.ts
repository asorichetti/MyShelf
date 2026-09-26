/**
 * E2E scan injection (P03-07): `/e2e/scan?isbn=…` or `?text=…` hands a scan
 * result to the Scan tab exactly where the camera or OCR would. The route
 * queues it here and opens the Scan tab, which takes it on focus.
 */
export type InjectedScan = { isbn: string } | { text: string };

let pending: InjectedScan | null = null;
const listeners = new Set<() => void>();

export function injectScan(scan: InjectedScan): void {
  pending = scan;
  for (const l of [...listeners]) l();
}

/** Takes the pending injected scan, if any (once). */
export function takeInjectedScan(): InjectedScan | null {
  const scan = pending;
  pending = null;
  return scan;
}

export function onInjectedScan(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
