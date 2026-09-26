import { act, fireEvent, screen } from '@testing-library/react-native';

import { LendSheet, type LendSubmitResult, type LendValues } from '@/components/loans/LendSheet';
import type { Borrower } from '@/domain';
import { loanIssueMessage } from '@/features/loans/useLend';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const sam: Borrower = { id: 1, name: 'Sam', contact: null };
const stats = { ...sam, openLoans: 0, totalLoans: 2, lastLentOn: '2026-05-01' };

async function renderSheet(onSubmit: (v: LendValues) => Promise<LendSubmitResult> = async () => ({ status: 'lent' }), onClose = jest.fn()) {
  renderWithTheme(
    <LendSheet
      visible
      bookTitle="Dune"
      today="2026-06-15"
      loanDays={28}
      onSubmit={onSubmit}
      onClose={onClose}
      search={async () => [stats]}
      findByName={async (name) => (name.toLowerCase() === 'sam' ? sam : null)}
      issueMessage={loanIssueMessage}
    />,
  );
  await act(async () => {});
  return { onSubmit, onClose };
}

const pickSam = async () => act(async () => fireEvent.press(screen.getByTestId(Testids.lend.borrowerOption)));
const save = async () => act(async () => fireEvent.press(screen.getByTestId(Testids.lend.save)));

describe('LendSheet', () => {
  it('is a dialog titled for the book, lent today and due after the loan length', async () => {
    await renderSheet();
    const sheet = screen.getByTestId(Testids.lend.sheet);
    expect(sheet.props.role).toBe('dialog');
    expect(screen.getByRole('heading', { name: 'Lend “Dune”' })).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.lend.lentOn).props.value).toBe('15/06/2026');
    expect(screen.getByTestId(Testids.lend.dueOn).props.value).toBe('13/07/2026');
    expect(screen.getByText('13 Jul 2026')).toBeOnTheScreen();
  });

  it('asks for a borrower before saving', async () => {
    const onSubmit = jest.fn(async () => ({ status: 'lent' as const }));
    await renderSheet(onSubmit);
    await save();
    expect(screen.getByTestId(Testids.lend.error)).toHaveTextContent(/Choose who’s borrowing it/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('saves the borrower, dates and note', async () => {
    const onSubmit = jest.fn(async () => ({ status: 'lent' as const }));
    await renderSheet(onSubmit);
    await pickSam();
    fireEvent.changeText(screen.getByTestId(Testids.lend.dueOn), '29/06/2026');
    fireEvent.changeText(screen.getByTestId(Testids.lend.note), 'For the train');
    await save();
    expect(onSubmit).toHaveBeenCalledWith({ borrower: { kind: 'existing', borrower: sam }, lentOn: '2026-06-15', dueOn: '2026-06-29', note: 'For the train' });
  });

  it('keeps the loan length when the lent date moves, until the due date is set by hand', async () => {
    await renderSheet();
    fireEvent.changeText(screen.getByTestId(Testids.lend.lentOn), '01/06/2026');
    expect(screen.getByTestId(Testids.lend.dueOn).props.value).toBe('29/06/2026');
    fireEvent.changeText(screen.getByTestId(Testids.lend.dueOn), '20/06/2026');
    fireEvent.changeText(screen.getByTestId(Testids.lend.lentOn), '02/06/2026');
    expect(screen.getByTestId(Testids.lend.dueOn).props.value).toBe('20/06/2026');
  });

  it('"No due date" is a checkbox that hides the due date and saves null', async () => {
    const onSubmit = jest.fn(async () => ({ status: 'lent' as const }));
    await renderSheet(onSubmit);
    await pickSam();
    const box = screen.getByTestId(Testids.lend.noDueDate);
    expect(box.props.role).toBe('checkbox');
    expect(box).not.toBeChecked();
    await act(async () => fireEvent.press(box));
    expect(screen.getByTestId(Testids.lend.noDueDate)).toBeChecked();
    expect(screen.queryByTestId(Testids.lend.dueOn)).toBeNull();
    await save();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dueOn: null }));
  });

  it.each([
    ['a lent date in the future', Testids.lend.lentOn, '16/06/2026', 'The day you lent it can’t be in the future.'],
    ['a due date before the lent date', Testids.lend.dueOn, '14/06/2026', 'The due date can’t be before the day you lent it.'],
    ['a date that does not exist', Testids.lend.dueOn, '31/06/2026', 'Enter a due date like 12/10/2026, or choose “No due date”.'],
  ])('refuses %s with a message by the field and in the summary', async (_, field, text, message) => {
    const onSubmit = jest.fn(async () => ({ status: 'lent' as const }));
    await renderSheet(onSubmit);
    await pickSam();
    fireEvent.changeText(screen.getByTestId(field), text);
    await save();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId(Testids.lend.error)).toHaveTextContent(message);
    expect(screen.getByTestId(field).props['aria-invalid']).toBe(true);
  });

  it('asks for another borrower when the chosen one has just been removed', async () => {
    await renderSheet(async () => ({ status: 'borrower-missing' }));
    await pickSam();
    await save();
    expect(screen.getByTestId(Testids.lend.error)).toHaveTextContent('That borrower has just been removed. Choose someone else.');
    expect(screen.getByTestId(Testids.lend.borrowerSearch)).toBeOnTheScreen();
  });

  it('says so when saving fails, and Cancel closes', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { onClose } = await renderSheet(async () => {
      throw new Error('disk full');
    });
    await pickSam();
    await save();
    expect(screen.getByTestId(Testids.lend.error)).toHaveTextContent('Sorry, I couldn’t save that loan. Please try again.');
    fireEvent.press(screen.getByTestId(Testids.lend.cancel));
    expect(onClose).toHaveBeenCalled();
  });
});
