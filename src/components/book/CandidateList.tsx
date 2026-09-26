import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { CandidateCard, type CandidateCardData } from './CandidateCard';

export interface CandidateListProps {
  candidates: readonly CandidateCardData[];
  onChoose: (index: number) => void;
  /** How many to show before "Show more". Default 5. */
  initialCount?: number;
  /** Heard before the list, e.g. "3 matches for “dune”". */
  label: string;
  testID?: string;
}

/** Lookup results, best first, as candidate cards; the rest behind "Show more". */
export function CandidateList({ candidates, onChoose, initialCount = 5, label, testID = Testids.lookup.results }: CandidateListProps) {
  const { spacing } = useTheme();
  const [shown, setShown] = useState(initialCount);
  const visible = candidates.slice(0, shown);
  return (
    <View testID={testID} style={{ gap: spacing.sm }}>
      <Text variant="label" color="inkMuted" aria-live="polite" accessibilityLiveRegion="polite">
        {label}
      </Text>
      {/* Only the cards are list items; the count above and "Show more" below sit outside the list. */}
      <View role="list" aria-label={label} style={{ gap: spacing.sm }}>
        {visible.map((c, i) => (
          <View role="listitem" key={`${c.source}-${i}-${c.title}`}>
            <CandidateCard candidate={c} onPress={() => onChoose(i)} />
          </View>
        ))}
      </View>
      {candidates.length > shown ? (
        <Button
          variant="ghost"
          label={t('candidate.showMore', { count: Math.min(candidates.length - shown, 5) })}
          onPress={() => setShown((n) => n + 5)}
          testID={Testids.lookup.showMore}
        />
      ) : null}
    </View>
  );
}
