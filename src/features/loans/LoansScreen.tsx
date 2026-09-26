import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Booky, HelpButton } from '@/components/booky';
import { LoanRow } from '@/components/loans/LoanRow';
import { EmptyState, Heading, Screen, SelectField, Text } from '@/components/ui';
import type { LoanWithDetails } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useReturnFlow } from './ReturnFlow';
import { useLoans } from './useLoans';

type Section = 'out' | 'history';

const PANEL_ID = 'loans-panel';

function SegmentTab({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID: string }) {
  const { colors, spacing, radii, sizes } = useTheme();
  return (
    <Pressable
      role="tab"
      aria-selected={selected}
      aria-controls={PANEL_ID}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.segment,
        {
          minHeight: sizes.touchTarget,
          // Half the height: a pill on one line, a rounded box if a large font wraps the two tabs.
          borderRadius: radii.xl,
          paddingHorizontal: spacing.lg,
          backgroundColor: selected ? colors.primary : pressed ? colors.surfaceTint : colors.surface,
        },
      ]}
    >
      <Text variant="bodyStrong" color={selected ? 'onPrimary' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The Loans tab: what is out now (overdue first, then by due date) and the
 * history of returned loans, as library card pockets with due-date stamps.
 * A borrower filter narrows both lists.
 */
export function LoansScreen() {
  const { colors, spacing, radii } = useTheme();
  const { out, history, overdueCount, today } = useLoans();
  const [section, setSection] = useState<Section>('out');
  const [borrowerId, setBorrowerId] = useState('');
  const returning = useReturnFlow();

  const openBook = useCallback((id: number) => router.navigate({ pathname: '/book/[id]', params: { id: String(id) } }), []);
  const openBorrower = useCallback((id: number) => router.navigate({ pathname: '/borrower/[id]', params: { id: String(id) } }), []);

  const borrowers = useMemo(() => {
    const seen = new Map<number, string>();
    for (const l of [...(out ?? []), ...(history ?? [])]) seen.set(l.borrowerId, l.borrowerName);
    return [...seen].map(([id, name]) => ({ value: String(id), label: name })).sort((a, b) => a.label.localeCompare(b.label));
  }, [out, history]);
  const filter = (list: LoanWithDetails[] | null) => (list && borrowerId ? list.filter((l) => String(l.borrowerId) === borrowerId) : list);
  const shown = filter(section === 'out' ? out : history);
  const who = borrowers.find((b) => b.value === borrowerId)?.label;

  if (out == null || history == null) {
    return (
      <Screen testID={Testids.loans.root} pageState="loading">
        <Heading level={1} testID={Testids.loans.title}>
          {t('loans.screen.title')}
        </Heading>
        <Text color="inkMuted">{t('loans.screen.loading')}</Text>
      </Screen>
    );
  }

  const empty =
    section === 'out' ? (
      who ? (
        <EmptyState
          testID={Testids.emptyState.root}
          illustration={<Booky expression="sleepy" size={96} />}
          title={t('loans.empty.borrowerNothingOutTitle', { name: who })}
          message={t('loans.empty.borrowerNothingOutMessage')}
          action={{ label: t('loans.empty.showEveryone'), onPress: () => setBorrowerId(''), variant: 'secondary' }}
        />
      ) : (
        <EmptyState
          testID={Testids.emptyState.root}
          illustration={<Booky expression="sleepy" size={112} />}
          title={t('loans.empty.allHomeTitle')}
          message={t('loans.empty.allHomeMessage')}
          action={{ label: t('loans.empty.goToShelf'), onPress: () => router.navigate('/'), variant: 'secondary' }}
        />
      )
    ) : (
      <EmptyState
        testID={Testids.emptyState.root}
        illustration={<Booky expression="sleepy" size={96} />}
        title={who ? t('loans.empty.historyBorrowerTitle', { name: who }) : t('loans.empty.historyTitle')}
        message={t('loans.empty.historyMessage')}
        action={{ label: t('loans.empty.seeWhatsOut'), onPress: () => setSection('out'), variant: 'secondary' }}
      />
    );

  return (
    <Screen testID={Testids.loans.root}>
      <View style={{ gap: spacing.xs }}>
        <View style={[styles.titleRow, { gap: spacing.sm }]}>
          <Heading level={1} testID={Testids.loans.title} style={styles.fill}>
            {t('loans.screen.title')}
          </Heading>
          <HelpButton screen="loans" />
        </View>
        <Text color="inkMuted">{t('loans.screen.intro')}</Text>
        {overdueCount ? (
          <Text variant="stamp" color="danger">
            {t('loans.screen.overdueCount', { count: overdueCount })}
          </Text>
        ) : null}
      </View>
      <View
        role="tablist"
        aria-label={t('loans.screen.title')}
        style={[styles.segments, { gap: spacing.xs, padding: spacing.xxs, borderRadius: radii.xl + spacing.xxs, borderColor: colors.outline, backgroundColor: colors.surface }]}
      >
        <SegmentTab label={t('loans.screen.tabOut', { count: out.length })} selected={section === 'out'} onPress={() => setSection('out')} testID={Testids.loans.tabOut} />
        <SegmentTab label={t('loans.screen.tabHistory', { count: history.length })} selected={section === 'history'} onPress={() => setSection('history')} testID={Testids.loans.tabHistory} />
      </View>
      {borrowers.length > 1 ? (
        <SelectField label={t('loans.screen.borrowerFilter')} placeholder={t('loans.screen.everyone')} value={borrowerId} options={borrowers} onChange={setBorrowerId} testID={Testids.loans.filterBorrower} />
      ) : null}
      <View nativeID={PANEL_ID} role="tabpanel" aria-label={section === 'out' ? t('loans.screen.tabOutName') : t('loans.screen.tabHistoryName')} testID={Testids.loans.list} style={{ gap: spacing.md }}>
        {shown?.length ? (
          shown.map((loan) => <LoanRow key={loan.id} loan={loan} today={today} onOpenBook={openBook} onOpenBorrower={openBorrower} onReturn={returning.start} />)
        ) : (
          <View testID={Testids.loans.empty}>{empty}</View>
        )}
      </View>
      {returning.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1.5, flexWrap: 'wrap' },
  segment: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
});
