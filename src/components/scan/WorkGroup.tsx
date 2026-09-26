import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CandidateCardData } from '@/components/book/CandidateCard';
import { CoverImage } from '@/components/book/CoverImage';
import { Text } from '@/components/ui';
import { joinNames } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import type { ReactNode } from 'react';

export interface WorkGroupProps {
  work: CandidateCardData;
  expanded: boolean;
  onToggle: () => void;
  /** Loading placeholders instead of editions. */
  loading?: boolean;
  /** The editions (EditionRow) when expanded. */
  children?: ReactNode;
  /** "Couldn't load the editions" and the like. */
  message?: string | null;
}

/** A placeholder card while editions load. */
export function EditionSkeleton() {
  const { colors, spacing, radii } = useTheme();
  return (
    <View
      testID={Testids.picker.skeleton}
      aria-hidden
      style={[styles.skeleton, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, gap: spacing.md }]}
    >
      <View style={{ width: 48, height: 72, borderRadius: radii.sm, backgroundColor: colors.surfaceTint }} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <View style={{ height: 16, width: '70%', borderRadius: radii.sm, backgroundColor: colors.surfaceTint }} />
        <View style={{ height: 12, width: '45%', borderRadius: radii.sm, backgroundColor: colors.cardLine }} />
        <View style={{ height: 12, width: '55%', borderRadius: radii.sm, backgroundColor: colors.cardLine }} />
      </View>
    </View>
  );
}

/**
 * A work in the edition picker (P03-08): its cover, title, author, first
 * publication and edition count, as a button that opens its editions.
 */
export function WorkGroup({ work, expanded, onToggle, loading, children, message }: WorkGroupProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  const author = joinNames(work.authors);
  const facts = [
    work.publicationYear != null ? `${work.kind === 'work' ? 'First published ' : ''}${work.publicationYear}` : null,
    work.editionCount ? `${work.editionCount} ${work.editionCount === 1 ? 'edition' : 'editions'}` : null,
  ].filter(Boolean);
  const label = [work.title, author ? `by ${author}` : null, ...facts].filter(Boolean).join(', ');
  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        role="button"
        aria-expanded={expanded}
        accessibilityState={{ expanded }}
        accessibilityLabel={`${label}. ${expanded ? 'Hide' : 'Show'} its editions`}
        aria-label={`${label}. ${expanded ? 'Hide' : 'Show'} its editions`}
        onPress={onToggle}
        testID={Testids.picker.work}
        style={({ pressed }) => [
          styles.header,
          {
            minHeight: sizes.touchTarget,
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: pressed ? colors.surfaceTint : colors.primaryContainer,
            borderColor: colors.primary,
          },
        ]}
      >
        <CoverImage uri={work.coverUrl} title={work.title} author={author} size="thumb" />
        <View style={[styles.text, { gap: spacing.xxs }]}>
          <Text variant="bodyStrong" color="onPrimaryContainer">
            {work.title}
          </Text>
          {author ? (
            <Text variant="mono" color="onPrimaryContainer">
              {author}
            </Text>
          ) : null}
          {facts.length ? (
            <Text variant="caption" color="onPrimaryContainer">
              {facts.join(' · ')}
            </Text>
          ) : null}
        </View>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={sizes.icon + 4} color={colors.onPrimaryContainer} aria-hidden />
      </Pressable>
      {expanded ? (
        <View role="radiogroup" aria-label={`Editions of ${work.title}`} style={{ gap: spacing.sm, paddingLeft: spacing.md }}>
          {loading ? (
            <>
              <EditionSkeleton />
              <EditionSkeleton />
              <EditionSkeleton />
            </>
          ) : null}
          {message ? (
            <Text variant="caption" color="inkMuted">
              {message}
            </Text>
          ) : null}
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  text: { flex: 1 },
  skeleton: { flexDirection: 'row', borderWidth: 1 },
});
