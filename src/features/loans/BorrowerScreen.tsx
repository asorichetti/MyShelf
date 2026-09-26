import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { CONTACT_HELP } from '@/components/loans/BorrowerPicker';
import { LoanRow } from '@/components/loans/LoanRow';
import { Button, ConfirmDialog, EmptyState, Heading, IconButton, Screen, Sheet, Text, TextField, useSnackbar } from '@/components/ui';
import { formatDate, today as todayOf } from '@/domain';
import { parseBookId } from '@/features/book/useBook';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useReturnFlow } from './ReturnFlow';
import { useBorrower, type BorrowerDetail } from './useBorrower';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;
const books = (n: number) => (n === 1 ? '1 book' : `${n} books`);

function goBackOrLoans() {
  if (router.canGoBack()) router.back();
  else router.replace('/loans');
}

/** "Has 1 book now · borrowed 3 times since 5 Jun 2025". */
export function borrowerStats({ current, past }: Pick<BorrowerDetail, 'current' | 'past'>): string {
  const total = current.length + past.length;
  if (!total) return 'Hasn’t borrowed anything yet';
  const first = [...current, ...past].map((l) => l.lentOn).sort()[0];
  const now = current.length ? `Has ${books(current.length)} now` : 'Has nothing out';
  return `${now} · borrowed ${total === 1 ? 'once' : `${total} times`} since ${formatDate(first)}`;
}

function EditSheet({
  detail,
  onSave,
  onClose,
}: {
  detail: BorrowerDetail;
  onSave: (name: string, contact: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(detail.borrower.name);
  const [contact, setContact] = useState(detail.borrower.contact ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const problem = await onSave(name, contact);
      setError(problem);
    } catch (e) {
      console.error('Could not save the borrower', e);
      setError('Sorry, I couldn’t save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet
      visible
      title={`Edit ${detail.borrower.name}`}
      onClose={onClose}
      busy={saving}
      testID={Testids.borrower.editSheet}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} disabled={saving} />
          <Button label="Save" onPress={() => void save()} loading={saving} testID={Testids.borrower.editSave} />
        </>
      }
    >
      <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" errorText={error ?? undefined} testID={Testids.borrower.editName} />
      <TextField
        label="How to reach them (optional)"
        value={contact}
        onChangeText={setContact}
        helperText={CONTACT_HELP}
        autoCapitalize="none"
        testID={Testids.borrower.editContact}
      />
    </Sheet>
  );
}

function BorrowerContent({ detail, hooks }: { detail: BorrowerDetail; hooks: ReturnType<typeof useBorrower> }) {
  const { colors, spacing, radii } = useTheme();
  const { show } = useSnackbar();
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
      show({ message: `Removed ${borrower.name}` });
      goBackOrLoans();
    } catch (e) {
      console.error('Could not remove the borrower', e);
      setDeleting(false);
      setConfirming(false);
      show({ message: `Sorry, I couldn’t remove ${borrower.name}. Please try again.` });
    }
  };

  return (
    <Screen testID={Testids.borrower.root} edges={[...EDGES]}>
      <View style={[styles.bar, { gap: spacing.xs, marginTop: -spacing.sm, marginHorizontal: -spacing.sm }]}>
        <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={goBackOrLoans} testID={Testids.borrower.back} />
        <View style={styles.flex} />
        <IconButton
          icon="pencil-outline"
          variant="tonal"
          accessibilityLabel={`Edit ${borrower.name}`}
          onPress={() => setEditing(true)}
          testID={Testids.borrower.edit}
        />
        <IconButton icon="trash-can-outline" variant="danger" accessibilityLabel={`Remove ${borrower.name}`} onPress={askDelete} testID={Testids.borrower.delete} />
      </View>

      {/* The library card pocket: who they are, as on a borrower's ticket. */}
      <View
        style={[
          styles.pocket,
          { gap: spacing.xs, padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.surface, borderColor: colors.border, borderTopColor: colors.cardRule },
        ]}
      >
        <Text variant="stamp" color="accent">
          Borrower’s card
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
            No contact details. Add some with Edit — they stay on this phone.
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
            {`${borrower.name} still has ${books(current.length)} of yours. Mark ${current.length === 1 ? 'it' : 'them'} returned first, then you can remove ${borrower.name}.`}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: spacing.md }} testID={Testids.borrower.current}>
        <Heading level={2}>Currently has</Heading>
        {current.length ? (
          current.map((loan) => <LoanRow key={loan.id} loan={loan} today={today} onOpenBook={openBook} onReturn={returning.start} />)
        ) : (
          <Text color="inkMuted">Nothing right now — every book is home.</Text>
        )}
      </View>

      <View style={{ gap: spacing.md }} testID={Testids.borrower.past}>
        <Heading level={2}>Has borrowed before</Heading>
        {past.length ? (
          past.map((loan) => <LoanRow key={loan.id} loan={loan} today={today} onOpenBook={openBook} />)
        ) : (
          <Text color="inkMuted">No returned loans yet.</Text>
        )}
      </View>

      {editing ? (
        <EditSheet
          detail={detail}
          onClose={() => setEditing(false)}
          onSave={async (name, contact) => {
            const outcome = await hooks.save(name, contact);
            if (outcome.status === 'saved') {
              setEditing(false);
              show({ message: 'Saved' });
              return null;
            }
            if (outcome.status === 'duplicate') return `${outcome.other.name} is already a borrower. Pick a different name.`;
            if (outcome.status === 'blank') return 'Give them a name.';
            return 'This borrower has been removed.';
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={confirming}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title={`Remove ${borrower.name}?`}
        message={
          past.length
            ? `This also clears their lending history (${past.length === 1 ? '1 past loan' : `${past.length} past loans`}). Your books stay on your shelf.`
            : 'They haven’t borrowed anything, so nothing else changes.'
        }
        confirmLabel="Remove"
        cancelLabel="Keep"
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
  const hooks = useBorrower(parseBookId(id));
  if (hooks.status === 'missing') {
    return (
      <Screen pageState="error" testID={Testids.borrower.missing} centered edges={[...EDGES]}>
        <EmptyState
          illustration={<Booky expression="concerned" size={120} />}
          headingLevel={1}
          title="Borrower not found"
          message="I can’t find that borrower. They may have been removed."
          action={{ label: 'Back to loans', onPress: () => router.replace('/loans'), testID: Testids.borrower.missingBack }}
        />
      </Screen>
    );
  }
  if (hooks.status === 'loading') {
    return (
      <Screen pageState="loading" centered edges={[...EDGES]}>
        <Text color="inkMuted" align="center">
          Finding their card…
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
