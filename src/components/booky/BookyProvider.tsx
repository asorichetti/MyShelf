import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { BookyBubble, type BookyAction } from './BookyBubble';
import type { BookyExpression } from './expressions';

export interface BookyTip {
  message: string;
  title?: string;
  expression?: BookyExpression;
  actions?: BookyAction[];
  /** Whether the user can close the tip (default true). */
  dismissible?: boolean;
}

interface BookyContextValue {
  tip: BookyTip | null;
  showTip: (tip: BookyTip) => void;
  dismissTip: () => void;
}

const BookyContext = createContext<BookyContextValue | null>(null);

export function BookyProvider({ children, initialTip = null }: { children: ReactNode; initialTip?: BookyTip | null }) {
  const [tip, setTip] = useState<BookyTip | null>(initialTip);
  const showTip = useCallback((next: BookyTip) => setTip(next), []);
  const dismissTip = useCallback(() => setTip(null), []);
  const value = useMemo(() => ({ tip, showTip, dismissTip }), [tip, showTip, dismissTip]);
  return <BookyContext.Provider value={value}>{children}</BookyContext.Provider>;
}

/** Show or dismiss Booky's tips from anywhere below a BookyProvider. */
export function useBooky(): BookyContextValue {
  const ctx = useContext(BookyContext);
  if (!ctx) throw new Error('useBooky must be used inside a BookyProvider');
  return ctx;
}

/** Renders the current tip, floating over the content. Place once per layout. */
export function BookyTipHost({ style }: { style?: StyleProp<ViewStyle> }) {
  const { tip, dismissTip } = useBooky();
  const { spacing, sizes } = useTheme();
  if (!tip) return null;
  const actions = tip.actions?.map((a) => ({
    ...a,
    onPress: () => {
      a.onPress();
      dismissTip();
    },
  }));
  return (
    <View
      style={[styles.host, { left: spacing.md, right: spacing.md, bottom: spacing.md, maxWidth: sizes.bubbleMaxWidth }, style]}
      testID={Testids.booky.tipHost}
    >
      <BookyBubble
        message={tip.message}
        title={tip.title}
        expression={tip.expression}
        actions={actions}
        onDismiss={tip.dismissible === false ? undefined : dismissTip}
        testID={Testids.booky.bubble}
        messageTestID={Testids.booky.bubbleMessage}
        dismissTestID={Testids.booky.bubbleDismiss}
        avatarTestID={Testids.booky.avatar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { pointerEvents: 'box-none', position: 'absolute', alignSelf: 'center' },
});
