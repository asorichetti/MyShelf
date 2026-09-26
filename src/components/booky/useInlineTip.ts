import { useEffect, useMemo, useState } from 'react';

import { useOptionalBooky } from './BookyProvider';
import { initialEngineState, selectTip, type BookyEvent, type SelectedTip } from './engine';

/**
 * A tip the screen draws itself, in place (`placement: 'inline'`, e.g. the
 * scanner's "No barcode? Try reading the cover instead."). While `active`,
 * asks the engine once; returns the tip to draw, or null when the engine says
 * no (already shown this session, muted, wrong mode). Outside a
 * BookyProvider the catalogue's tip is returned as is.
 */
export function useInlineTip(event: BookyEvent, active: boolean): SelectedTip | null {
  const booky = useOptionalBooky();
  const emit = booky?.emit;
  const [tip, setTip] = useState<SelectedTip | null>(null);
  const { type, variant, key } = event;

  useEffect(() => {
    if (!active || !emit) return;
    let live = true;
    void emit({ type, variant, key }).then((shown) => live && setTip(shown));
    return () => {
      live = false;
      setTip(null);
    };
  }, [active, emit, type, variant, key]);

  // Without a provider there is no memory: the catalogue's tip, as is.
  const standalone = useMemo(() => (emit ? null : selectTip(initialEngineState(''), { type, variant, key }, 0)), [emit, type, variant, key]);
  if (!active) return null;
  return emit ? tip : standalone;
}
