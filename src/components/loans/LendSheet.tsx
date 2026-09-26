import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, DateField, Sheet, Text, TextField } from '@/components/ui';
import type { BorrowerWithStats } from '@/db';
import { defaultDueDate, isIsoDate, validateLoanDates, type Borrower, type IsoDate, type LoanIssue } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { BorrowerPicker, type BorrowerChoice } from './BorrowerPicker';

export interface LendValues {
  borrower: BorrowerChoice;
  lentOn: IsoDate;
  dueOn: IsoDate | null;
  note: string;
}

/** What the sheet needs to hear back from a save. */
export type LendSubmitResult =
  | { status: 'lent' }
  | { status: 'invalid'; issues: LoanIssue[] }
  | { status: 'borrower-missing' }
  | { status: 'book-missing' }
  /** Anything the caller handles itself (e.g. already on loan: it closes the sheet). */
  | { status: 'handled' };

export interface LendSheetProps {
  visible: boolean;
  bookTitle: string;
  /** Today's date (from the app clock), the default lent-on date. */
  today: IsoDate;
  /** Loan length setting for the default due date. */
  loanDays: number;
  onSubmit: (values: LendValues) => Promise<LendSubmitResult>;
  onClose: () => void;
  search: (prefix: string) => Promise<BorrowerWithStats[]>;
  findByName: (name: string) => Promise<Borrower | null>;
  /** Plain words for a date problem. */
  issueMessage: (issue: LoanIssue) => string;
}

type Errors = Partial<Record<'borrower' | 'lentOn' | 'dueOn' | 'form', string>>;

/**
 * Lend a book: who (BorrowerPicker), when (lent today by default), when it is
 * due back (the configured loan length later, or "No due date") and an
 * optional note. Dates are checked with `validateLoanDates` before saving;
 * problems show under their field and in a summary.
 */
export function LendSheet({ visible, bookTitle, today, loanDays, onSubmit, onClose, search, findByName, issueMessage }: LendSheetProps) {
  const { colors, spacing, sizes, radii } = useTheme();
  const [borrower, setBorrower] = useState<BorrowerChoice | null>(null);
  const [lentOn, setLentOn] = useState<string>(today);
  const [dueOn, setDueOn] = useState<string>(() => defaultDueDate(today, loanDays));
  const dueTouched = useRef(false);
  const [noDue, setNoDue] = useState(false);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const changeLentOn = (value: string) => {
    setLentOn(value);
    // Keep the loan length when the lent date moves, until the due date is set by hand.
    if (!dueTouched.current && isIsoDate(value)) setDueOn(defaultDueDate(value, loanDays));
  };

  const save = async () => {
    const next: Errors = {};
    if (!borrower) next.borrower = 'Choose who’s borrowing it, or add their name.';
    for (const issue of validateLoanDates({ lentOn, dueOn: noDue ? null : dueOn }, today)) {
      const field = issue.field === 'dueOn' ? 'dueOn' : 'lentOn';
      next[field] ??= issueMessage(issue);
    }
    if (!noDue && !dueOn) next.dueOn = 'Enter a due date, or choose “No due date”.';
    setErrors(next);
    if (Object.keys(next).length || !borrower) return;
    setSaving(true);
    try {
      const result = await onSubmit({ borrower, lentOn, dueOn: noDue ? null : dueOn, note });
      if (result.status === 'invalid') {
        const fromRepo: Errors = {};
        for (const issue of result.issues) fromRepo[issue.field === 'dueOn' ? 'dueOn' : 'lentOn'] ??= issueMessage(issue);
        setErrors(fromRepo);
      } else if (result.status === 'borrower-missing') {
        setBorrower(null);
        setErrors({ borrower: 'That borrower has just been removed. Choose someone else.' });
      } else if (result.status === 'book-missing') {
        setErrors({ form: 'This book is no longer on your shelf.' });
      }
    } catch (e) {
      console.error('Could not lend the book', e);
      setErrors({ form: 'Sorry, I couldn’t save that loan. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const summary = [errors.form, errors.borrower, errors.lentOn, errors.dueOn].filter(Boolean);

  return (
    <Sheet
      visible={visible}
      title={`Lend “${bookTitle}”`}
      subtitle="I’ll stamp the due date and keep an eye on it for you."
      onClose={onClose}
      busy={saving}
      testID={Testids.lend.sheet}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} disabled={saving} testID={Testids.lend.cancel} />
          <Button label="Lend" onPress={() => void save()} loading={saving} testID={Testids.lend.save} />
        </>
      }
    >
      {summary.length ? (
        <View role="alert" testID={Testids.lend.error} style={{ padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.dangerContainer, gap: spacing.xxs }}>
          {summary.map((message) => (
            <Text key={message} color="onDangerContainer">
              {message}
            </Text>
          ))}
        </View>
      ) : null}
      <BorrowerPicker
        value={borrower}
        onChange={(choice) => {
          setBorrower(choice);
          if (choice) setErrors((e) => ({ ...e, borrower: undefined }));
        }}
        search={search}
        findByName={findByName}
        errorText={errors.borrower}
      />
      <DateField label="Lent on" value={lentOn} onChange={changeLentOn} max={today} errorText={errors.lentOn} testID={Testids.lend.lentOn} />
      <View style={{ gap: spacing.sm }}>
        {noDue ? null : (
          <DateField
            label="Due back"
            value={dueOn}
            onChange={(value) => {
              dueTouched.current = true;
              setDueOn(value);
            }}
            min={isIsoDate(lentOn) ? lentOn : undefined}
            helperText={`${loanDays} days after lending, unless you change it`}
            errorText={errors.dueOn}
            testID={Testids.lend.dueOn}
          />
        )}
        <Pressable
          role="checkbox"
          aria-checked={noDue}
          accessibilityState={{ checked: noDue }}
          accessibilityLabel="No due date"
          onPress={() => {
            setNoDue((v) => !v);
            setErrors((e) => ({ ...e, dueOn: undefined }));
          }}
          testID={Testids.lend.noDueDate}
          style={({ pressed }) => [
            styles.check,
            { minHeight: sizes.touchTarget, gap: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: radii.sm },
            pressed && { backgroundColor: colors.surfaceTint },
          ]}
        >
          <MaterialCommunityIcons
            name={noDue ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={sizes.icon + 4}
            color={noDue ? colors.primary : colors.outline}
          />
          <Text>No due date</Text>
        </Pressable>
      </View>
      <TextField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Bring it to book club"
        multiline
        testID={Testids.lend.note}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
