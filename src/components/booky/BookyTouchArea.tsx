import { useCallback, type ReactNode } from 'react';
import { View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useOptionalBooky } from './BookyProvider';
import { getTipBox, isOutside } from './tipBox';

/**
 * Wraps the app so a tap anywhere outside Booky's floating tip puts it away
 * (P07-06). It only watches: the tap still goes where it was aimed (the
 * capture handler never claims the touch).
 */
export function BookyTouchArea({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const booky = useOptionalBooky();
  const tip = booky?.tip ?? null;
  const dismissTip = booky?.dismissTip;
  const onCapture = useCallback(
    (e: GestureResponderEvent) => {
      const box = getTipBox();
      if (tip && box && dismissTip && isOutside(box, e.nativeEvent.pageX, e.nativeEvent.pageY)) dismissTip();
      return false;
    },
    [tip, dismissTip],
  );
  return (
    <View style={style} onStartShouldSetResponderCapture={onCapture}>
      {children}
    </View>
  );
}
