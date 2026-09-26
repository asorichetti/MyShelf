import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True while a screen reader (TalkBack, VoiceOver) is on. */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.resolve(AccessibilityInfo.isScreenReaderEnabled())
      .then((value) => active && setOn(Boolean(value)))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (value) => setOn(Boolean(value)));
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);
  return on;
}
