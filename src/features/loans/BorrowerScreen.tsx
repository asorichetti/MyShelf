import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Booky, useBookyTopic } from '@/components/booky';
import { LoanRow } from '@/components/loans/LoanRow';
import { Button, ConfirmDialog, EmptyState, Heading, IconButton, Screen, Sheet, Text, TextField, useSnackbar } from '@/components/ui';
import { formatDate, today as todayOf, type Borrower } from '@/domain';
import { parseBookId } from '@/features/book/useBook';
import { useMounted } from '@/hooks/useMounted';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useReturnFlow } from './ReturnFlow';
import { useBorrower, type BorrowerDetail } from './useBorrower';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

function goBackOrLoans() {
  if (router.canGoBack()) router.back();
  else router.replace('/loans');
}

/** "Has 1 book now · borrowed 3 times since 5 Jun 2025". */
export function borrowerStats({ current, past }: Pick<BorrowerDetail, 'current' | 'past'>): string {
  const total = current.length + past.length;
  if (!total) return t('borrowers.stats.never');
  const first = [...current, ...past].map((l) => l.lentOn).sort()[0];
  const now = current.length ? t('borrowers.stats.hasNow', { count: current.length }) : t('borrowers.stats.nothingOut');
  return t('borrowers.stats.line', { now, count: total, date: formatDate(first) });
}

/** Rename a borrower or change how to reach them (also used by Settings → Borrowers). */
export function BorrowerEditSheet({
  borrower,
  onSave,
  onClose,
}: {
  borrower: Borrower;
  onSave: (name: string, contact: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(borrower.name);
  const [contact, setContact] = useState(borrower.contact ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const problem = await onSave(name, contact);
      setError(problem);
    } catch (e) {
      console.error('Could not save the borrower', e);
      setError(t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet
      visible
      title={t('borrowers.edit.title', { name: borrower.name })}
      onClose={onClose}
      busy={saving}
      testID={Testids.borrower.editSheet}
      footer={
        <>
          <Button label={t('common.cancel')} variant="secondary" onPress={onClose} disabled={saving} />
          <Button label={t('common.save')} onPress={() => void save()} loading={saving} testID={Testids.borrower.editSave} />
        </>
      }
    >
      <TextField label={t('borrowers.edit.name')} value={name} onChangeText={setName} autoCapitalize="words" errorText={error ?? undefined} testID={Testids.borrower.editName} />
      <TextField
        label={t('borrowers.edit.contact')}
        value={contact}
        onChangeText={setContact}
        helperText={t('lend.picker.contactHelp')}
        autoCapitalize="none"
        testID={Testids.borrower.editContact}
      />
    </Sheet>
  );
}

function BorrowerContent({ detail, hooks }: { detail: BorrowerDetail; hooks: ReturnType<typeof useBorrower> }) {
  const { colors, spacing, radii } = useTheme();
  const { show } = useSnackbar();
  const mounted = useMounted();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const returning = useReturnFlow();
  const today = todayOf();
  const { borrower, current, past } = detail;

  const openBook = useCallback((id: number) => router.navigate({ pathname: '/book/[id]', params: { id: String(id) } }), []);

  const askDelete = () => {
    if (current.length) setBlocked(true);
    else setConfirming(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const outcome = await hooks.remove();
      setConfirming(false);
      if (outcome === 'has-books-out') {
        setBlocked(true);
        setDeleting(false);
        return;
      }
      show({ message: t('borrowers.remove.removed', { name: borrower.name }) });
      if (mounted.current) goBackOrLoans();
    } catch (e) {
      console.error('Could not remove the borrower', e);
      setDeleting(false);
      setConfirming(false);
      show({ message: t('borrowers.remove.failed', { name: borrower.name }) });
    }
  };

  return (
    <Screen testID={Testids.borrower.root} edges={[...EDGES]}>
      <View style={[styles.bar, { gap: spacing.xs, marginTop: -spacing.sm, marginHorizontal: -spacing.sm }]}>
        <IconButton icon="arrow-left" accessibilityLabel={t('common.back')} onPress={goBackOrLoans} testID={Testids.borrower.back} />
        <View style={styles.flex} />
        <IconButton
          icon="pencil-outline"
          variant="tonal"
          accessibilityLabel={t('borrowers.edit.title', { name: borrower.name })}
          onPress={() => setEditing(true)}
          testID={Testids.borrower.edit}
        />
        <IconButton icon="trash-can-outline" variant="danger" accessibilityLabel={t('borrowers.remove.label', { name: borrower.name })} onPress={askDelete} testID={Testids.borrower.delete} />
      </View>

      {/* The library card pocket: who they are, as on a borrower's ticket. */}
      <View
        style={[
          styles.pocket,
          { gap: spacing.xs, padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.surface, borderColor: colors.border, borderTopColor: colors.cardRule },
        ]}
      >
        <Text variant="stamp" color="accent">
          {t('borrowers.screen.card')}
        </Text>
        <Heading level={1} testID={Testids.borrower.name}>
          {borrower.name}
        </Heading>
        {borrower.contact ? (
          <Text testID={Testids.borrower.contact} selectable>
            {borrower.contact}
          </Text>
        ) : (
          <Text color="inkMuted" testID={Testids.borrower.contact}>
            {t('borrowers.screen.noContact')}
          </Text>
        )}
        <Text variant="mono" color="inkMuted" testID={Testids.borrower.stats}>
          {borrowerStats(detail)}
        </Text>
      </View>

      {blocked ? (
        <View
          role="alert"
          testID={Testids.borrower.blocked}
          style={[styles.blocked, { gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.warnContainer }]}
        >
          <Booky expression="concerned" size={48} animated={false} />
          <Text color="onWarnContainer" style={styles.flex}>
            {t('borrowers.remove.blocked', { name: borrower.name, count: current.length })}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: spacing.md }} testID={Testids.borrower.current}>
        <Heading level={2}>{t('borrowers.screen.currentHeading')}</Heading>
        {current.length ? (
          current.map((loan) => <LoanRow key={loan.id} loan={loan} today={today} onOpenBook={openBook} onReturn={returning.start} />)
        ) : (
          <Text color="inkMuted">{t('borrowers.screen.currentEmpty')}</Text>
        )}
      </View>

      <View style={{ gap: spacing.md }} testID={Testids.borrower.past}>
        <Heading level={2}>{t('borrowers.screen.pastHeading')}</Heading>
        {past.length ? (
          past.map((loan) => <LoanRow key={loan.id} loan={loan} today={today} onOpenBook={openBook} />)
        ) : (
          <Text color="inkMuted">{t('borrowers.screen.pastEmpty')}</Text>
        )}
      </View>

      {editing ? (
        <BorrowerEditSheet
          borrower={borrower}
          onClose={() => setEditing(false)}
          onSave={async (name, contact) => {
            const outcome = await hooks.save(name, contact);
            if (outcome.status === 'saved') {
              setEditing(false);
              show({ message: t('borrowers.edit.saved') });
              return null;
            }
            if (outcome.status === 'duplicate') return t('borrowers.edit.duplicate', { name: outcome.other.name });
            if (outcome.status === 'blank') return t('borrowers.edit.blank');
            return t('borrowers.edit.gone');
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={confirming}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title={t('borrowers.remove.confirmTitle', { name: borrower.name })}
        message={
          past.length ? t('borrowers.remove.clearsHistory', { count: past.length }) : t('borrowers.remove.nothingElse')
        }
        confirmLabel={t('common.remove')}
        cancelLabel={t('borrowers.remove.keep')}
        destructive
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirming(false)}
      />
      {returning.sheet}
    </Screen>
  );
}

/** `/borrower/[id]`: a borrower's card, what they have now and what they borrowed before. */
export function BorrowerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const borrowerId = parseBookId(id);
  const hooks = useBorrower(borrowerId);
  // The page lists this borrower's loans with "Mark returned": Booky's nudge about them is not floated over it.
  useBookyTopic(borrowerId == null ? null : `borrower:${borrowerId}`);
  if (hooks.status === 'missing') {
    return (
      <Screen pageState="error" testID={Testids.borrower.missing} centered edges={[...EDGES]}>
        <EmptyState
          illustration={<Booky expression="concerned" size={120} />}
          headingLevel={1}
          title={t('borrowers.screen.missingTitle')}
          message={t('borrowers.screen.missingMessage')}
          action={{ label: t('borrowers.screen.backToLoans'), onPress: () => router.replace('/loans'), testID: Testids.borrower.missingBack }}
        />
      </Screen>
    );
  }
  if (hooks.status === 'loading') {
    return (
      <Screen pageState="loading" centered edges={[...EDGES]}>
        <Text color="inkMuted" align="center">
          {t('borrowers.screen.loading')}
        </Text>
      </Screen>
    );
  }
  return <BorrowerContent detail={hooks.detail} hooks={hooks} />;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  pocket: { borderWidth: 1, borderTopWidth: 4 },
  blocked: { flexDirection: 'row', alignItems: 'center' },
});
