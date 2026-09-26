import * as Haptics from 'expo-haptics';

/** A short tick when a barcode is read. Never throws: haptics are a nicety. */
export function tick(): void {
  Haptics.selectionAsync().catch(() => undefined);
}
