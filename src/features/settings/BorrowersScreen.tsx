import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { SettingsNotice } from '@/components/settings/SettingsControls';
import { ConfirmDialog, EmptyState, IconButton, Text, useSnackbar } from '@/components/ui';
import { loansRepo, useDatabase, type BorrowerWithStats } from '@/db';
import { emit, useLibraryEvent } from '@/features/events';
import { BorrowerEditSheet } from '@/features/loans/BorrowerScreen';
import { removeBorrower, saveBorrower } from '@/features/loans/useBorrower';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';


import { SettingsPage } from './SettingsPage';

const T = Testids.borrowers;

/** "has 1 book now · 3 loans in all" */
export function borrowerLine(b: BorrowerWithStats): string {
  const now = b.openLoans ? t('borrowers.settings.hasNow', { count: b.openLoans }) : t('borrowers.settings.nothingNow');
  return t('borrowers.settings.line', { now, all: t('borrowers.settings.loansInAll', { count: b.totalLoans }) });
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

  // Only the latest answer is shown (reloads can overlap), and none once the screen has gone.
  const asked = useRef(0);
  useEffect(
    () => () => {
      asked.current += 1;
    },
    [],
  );
  const load = useCallback(() => {
    const ask = ++asked.current;
    loansRepo
      .listBorrowersWithStats(db)
      .then((next) => ask === asked.current && setList(next))
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
        show({ message: t('borrowers.remove.removed', { name: deleting.name }) });
      } else if (outcome === 'has-books-out') setBlocked(deleting);
    } catch (e) {
      console.error('Could not remove the borrower', e);
      show({ message: t('borrowers.remove.failed', { name: deleting.name }) });
    }
    setBusy(false);
    setDeleting(null);
  };

  return (
    <SettingsPage title={t('borrowers.settings.title')} intro={t('borrowers.settings.intro')} testID={T.root} backTestID={T.back}>
      {blocked ? (
        <SettingsNotice tone="warn" role="alert">
          {t('borrowers.remove.blocked', { name: blocked.name, count: blocked.openLoans })}
        </SettingsNotice>
      ) : null}
      {list.length === 0 ? (
        <EmptyState
          testID={T.empty}
          illustration={<Booky expression="sleepy" size={96} />}
          title={t('borrowers.settings.emptyTitle')}
          message={t('borrowers.settings.emptyMessage')}
        />
      ) : (
        <View role="list" aria-label={t('borrowers.settings.title')} style={{ gap: spacing.sm }}>
          {list.map((b) => (
            <View
              key={b.id}
              role="listitem"
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, paddingRight: spacing.xs, boxShadow: theme.elevation.low }]}
            >
              <Pressable
                role="link"
                accessibilityLabel={t('borrowers.settings.rowLabel', { name: b.name, line: borrowerLine(b) })}
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
              <IconButton icon="pencil-outline" accessibilityLabel={t('borrowers.edit.title', { name: b.name })} onPress={() => setEditing(b)} testID={T.edit} />
              <IconButton icon="trash-can-outline" variant="danger" accessibilityLabel={t('borrowers.remove.label', { name: b.name })} onPress={() => askDelete(b)} testID={T.delete} />
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
        visible={deleting != null}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title={t('borrowers.remove.confirmTitle', { name: deleting?.name ?? '' })}
        message={
          deleting?.totalLoans ? t('borrowers.remove.clearsHistory', { count: deleting.totalLoans }) : t('borrowers.remove.nothingElse')
        }
        confirmLabel={t('common.remove')}
        cancelLabel={t('borrowers.remove.keep')}
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
