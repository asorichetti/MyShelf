import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { EmptyState, Heading, LetterIndex, Screen, Text, TopBar } from '@/components/ui';
import type { AuthorWithCount } from '@/db';
import { authorLetter } from '@/domain';
import { goBackOr } from '@/features/navigation/goBack';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useAuthors } from './useAuthors';

const books = (n: number) => (n === 1 ? '1 book' : `${n} books`);

/** Authors grouped under their index letter, in order. */
export function byLetter(authors: AuthorWithCount[]): { letter: string; authors: AuthorWithCount[] }[] {
  const out: { letter: string; authors: AuthorWithCount[] }[] = [];
  for (const a of authors) {
    const letter = authorLetter(a);
    const last = out[out.length - 1];
    if (last?.letter === letter) last.authors.push(a);
    else out.push({ letter, authors: [a] });
  }
  // "#" (numbers, symbols) goes last, like a library index.
  return [...out.filter((s) => s.letter !== '#'), ...out.filter((s) => s.letter === '#')];
}

/** `/authors`: every author A-Z by surname, with a letter index to jump straight to "P". */
export function AuthorsScreen() {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const authors = useAuthors();
  const sections = useMemo(() => byLetter(authors ?? []), [authors]);
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());
  const [current, setCurrent] = useState<string | null>(null);

  if (!authors) return <LoadingPage />;

  const jump = (letter: string) => {
    setCurrent(letter);
    const y = offsets.current.get(letter);
    if (y != null) scroller.current?.scrollTo({ y, animated: false });
  };

  return (
    <Screen testID={Testids.authors.root} scroll={false} edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.fill}>
      <TopBar onBack={() => goBackOr('/')} />
      <View style={{ gap: spacing.xs }}>
        <Heading level={1} testID={Testids.authors.title}>
          Authors
        </Heading>
        <Text color="inkMuted">{authors.length === 1 ? '1 author' : `${authors.length} authors`}, filed by surname.</Text>
      </View>
      {authors.length === 0 ? (
        <EmptyState
          testID={Testids.emptyState.root}
          illustration={<Booky expression="sleepy" size={112} />}
          title="No authors yet"
          message="Authors appear here as you add books."
          action={{ label: 'Add a book', onPress: () => router.navigate('/book/new'), variant: 'secondary' }}
        />
      ) : (
        <>
          <LetterIndex letters={sections.map((s) => s.letter)} current={current} onSelect={jump} testID={Testids.authors.letter} />
          <ScrollView ref={scroller} style={styles.fill} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}>
            {sections.map((section) => (
              <View key={section.letter} onLayout={(e) => offsets.current.set(section.letter, e.nativeEvent.layout.y)} style={{ gap: spacing.xs }}>
                <Heading level={2} accessibilityLabel={section.letter === '#' ? 'Numbers and symbols' : `Letter ${section.letter}`}>
                  {section.letter}
                </Heading>
                <View style={[styles.rule, { backgroundColor: colors.brass, borderRadius: radii.sm }]} aria-hidden />
                <View role="list" style={{ gap: spacing.xxs }}>
                  {section.authors.map((a) => (
                    <Pressable
                      key={a.id}
                      role="link"
                      accessibilityLabel={`${a.name}, ${books(a.count)}`}
                      aria-label={`${a.name}, ${books(a.count)}`}
                      onPress={() => router.navigate({ pathname: '/authors/[id]', params: { id: String(a.id) } })}
                      testID={Testids.authors.row}
                      style={({ pressed }) => [
                        styles.row,
                        { minHeight: sizes.touchTarget, paddingHorizontal: spacing.md, borderRadius: radii.md, gap: spacing.md },
                        { backgroundColor: pressed ? colors.surfaceTint : colors.surface },
                      ]}
                    >
                      <View style={styles.fill}>
                        <Text variant="bodyStrong" style={{ fontFamily: theme.fonts.heading }}>
                          {a.name}
                        </Text>
                        {a.sortName && a.sortName !== a.name ? (
                          <Text variant="mono" color="inkMuted">
                            {a.sortName}
                          </Text>
                        ) : null}
                      </View>
                      <Text variant="caption" color="inkMuted">
                        {books(a.count)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  rule: { height: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
