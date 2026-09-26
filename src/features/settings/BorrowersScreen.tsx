import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { SettingsNotice } from '@/components/settings/SettingsControls';
import { ConfirmDialog, EmptyState, IconButton, Text, useSnackbar } from '@/components/ui';
import { loansRepo, useDatabase, type BorrowerWithStats } from '@/db';
import { emit, useLibraryEvent } from '@/features/events';
import { BorrowerEditSheet } from '@/features/loans/BorrowerScreen';
import { removeBorrower, saveBorrower } from '@/features/loans/useBorrower';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';


import { SettingsPage } from './SettingsPage';

const T = Testids.borrowers;
const books = (n: number) => (n === 1 ? '1 book' : `${n} books`);

/** "has 1 book now · 3 loans in all" */
export function borrowerLine(b: BorrowerWithStats): string {
  const now = b.openLoans ? `has ${books(b.openLoans)} now` : 'has nothing now';
  const all = b.totalLoans === 1 ? '1 loan in all' : `${b.totalLoans} loans in all`;
  return `${now} · ${all}`;
}

/**
 * Settings → Borrowers (P08-10): everyone you have lent to, with loan
 * counts. Rename them, or remove them (only once they have nothing out;
 * their returned-loan history goes with them, as on their own page).
 */
export function BorrowersScreen() {
  const db = useDatabase();
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const { show } = useSnackbar();
  const [list, setList] = useState<BorrowerWithStats[] | null>(null);
  const [editing, setEditing] = useState<BorrowerWithStats | null>(null);
  const [deleting, setDeleting] = useState<BorrowerWithStats | null>(null);
  const [blocked, setBlocked] = useState<BorrowerWithStats | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    loansRepo
      .listBorrowersWithStats(db)
      .then(setList)
      .catch((e) => console.error('Could not list borrowers', e));
  }, [db]);
  useEffect(load, [load]);
  useLibraryEvent(['loans-changed', 'library-changed'], load);

  if (!list) return <LoadingPage />;

  const askDelete = (b: BorrowerWithStats) => {
    if (b.openLoans) {
      setBlocked(b);
      return;
    }
    setBlocked(null);
    setDeleting(b);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const outcome = await removeBorrower(db, deleting.id);
      if (outcome === 'deleted') {
        emit('loans-changed');
        show({ message: `Removed ${deleting.name}` });
      } else if (outcome === 'has-books-out') setBlocked(deleting);
    } catch (e) {
      console.error('Could not remove the borrower', e);
      show({ message: `Sorry, I couldn’t remove ${deleting.name}. Please try again.` });
    }
    setBusy(false);
    setDeleting(null);
  };

  return (
    <SettingsPage title="Borrowers" intro="The people you lend to. Open someone to see what they have and what they’ve borrowed before." testID={T.root} backTestID={T.back}>
      {blocked ? (
        <SettingsNotice tone="warn" role="alert">
          {`${blocked.name} still has ${books(blocked.openLoans)} of yours. Mark ${blocked.openLoans === 1 ? 'it' : 'them'} returned first, then you can remove ${blocked.name}.`}
        </SettingsNotice>
      ) : null}
      {list.length === 0 ? (
        <EmptyState
          testID={T.empty}
          illustration={<Booky expression="sleepy" size={96} />}
          title="No borrowers yet"
          message="When you lend a book, the person you lend it to appears here."
        />
      ) : (
        <View role="list" aria-label="Borrowers" style={{ gap: spacing.sm }}>
          {list.map((b) => (
            <View
              key={b.id}
              role="listitem"
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, paddingRight: spacing.xs, boxShadow: theme.elevation.low }]}
            >
              <Pressable
                role="link"
                accessibilityLabel={`${b.name}, ${borrowerLine(b)}`}
                onPress={() => router.navigate({ pathname: '/borrower/[id]', params: { id: String(b.id) } })}
                testID={T.row}
                style={({ pressed }) => [
                  styles.name,
                  { minHeight: sizes.touchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md },
                  pressed && { backgroundColor: colors.surfaceTint },
                ]}
              >
                <Text variant="bodyStrong" style={{ fontFamily: theme.fonts.heading }}>
                  {b.name}
                </Text>
                <Text variant="caption" color="inkMuted">
                  {borrowerLine(b)}
                </Text>
              </Pressable>
              <IconButton icon="pencil-outline" accessibilityLabel={`Edit ${b.name}`} onPress={() => setEditing(b)} testID={T.edit} />
              <IconButton icon="trash-can-outline" variant="danger" accessibilityLabel={`Remove ${b.name}`} onPress={() => askDelete(b)} testID={T.delete} />
            </View>
          ))}
        </View>
      )}
      {editing ? (
        <BorrowerEditSheet
          borrower={editing}
          onClose={() => setEditing(null)}
          onSave={async (name, contact) => {
            const outcome = await saveBorrower(db, editing.id, name, contact);
            if (outcome.status === 'saved') {
              emit('loans-changed');
              setEditing(null);
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
        visible={deleting != null}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title={`Remove ${deleting?.name ?? ''}?`}
        message={
          deleting?.totalLoans
            ? `This also clears their lending history (${deleting.totalLoans === 1 ? '1 past loan' : `${deleting.totalLoans} past loans`}). Your books stay on your shelf.`
            : 'They haven’t borrowed anything, so nothing else changes.'
        }
        confirmLabel="Remove"
        cancelLabel="Keep"
        destructive
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  name: { flex: 1, justifyContent: 'center' },
});
