import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Keyboard } from 'react-native';

import { BorrowerPicker, type BorrowerChoice } from '@/components/loans/BorrowerPicker';
import { booksRepo, loansRepo, type Db } from '@/db';
import { createTestDb } from '@/testing/createTestDb';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

let db: Db;
beforeEach(async () => {
  latest = null;
  jest.useFakeTimers();
  db = await createTestDb();
  const dune = await booksRepo.createBook(db, { title: 'Dune' });
  const mort = await booksRepo.createBook(db, { title: 'Mort' });
  const sam = await loansRepo.createBorrower(db, 'Sam', 'sam@example.org');
  const priya = await loansRepo.createBorrower(db, 'Priya Shah');
  await loansRepo.createBorrower(db, 'Zoë');
  await loansRepo.lendBook(db, { bookId: dune.id, borrowerId: sam.id, lentOn: '2026-06-01' });
  await loansRepo.lendBook(db, { bookId: mort.id, borrowerId: priya.id, lentOn: '2026-06-10' });
});
afterEach(async () => {
  jest.useRealTimers();
  await db.close();
});

let latest: BorrowerChoice | null = null;
function Harness() {
  const [value, setValue] = useState<BorrowerChoice | null>(null);
  return (
    <BorrowerPicker
      value={value}
      onChange={(choice) => {
        latest = choice;
        setValue(choice);
      }}
      search={(prefix) => loansRepo.searchBorrowers(db, prefix)}
      findByName={(name) => loansRepo.findBorrowerByName(db, name)}
    />
  );
}

/** Lets the debounce pass and the database answer. */
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  for (let i = 0; i < 3; i++) await act(async () => {});
}

async function type(text: string) {
  fireEvent.changeText(screen.getByTestId(Testids.lend.borrowerSearch), text);
  await settle();
}

const options = () => screen.queryAllByTestId(Testids.lend.borrowerOption).map((o) => o.props.accessibilityLabel);

describe('BorrowerPicker', () => {
  it('lists recent borrowers first, with what they have now', async () => {
    renderWithTheme(<Harness />);
    await settle();
    expect(options()).toEqual(['Lend to Priya Shah, has 1 book now', 'Lend to Sam, has 1 book now', 'Lend to Zoë, not borrowed anything yet']);
  });

  it('searches by the start of any word, ignoring case and accents', async () => {
    renderWithTheme(<Harness />);
    await type('SHA');
    expect(options()).toEqual(['Lend to Priya Shah, has 1 book now']);
    await type('zoe');
    expect(options()).toEqual(['Lend to Zoë, not borrowed anything yet']);
  });

  it('picks an existing borrower', async () => {
    renderWithTheme(<Harness />);
    await type('sa');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.lend.borrowerOption)));
    expect(latest).toEqual({ kind: 'existing', borrower: expect.objectContaining({ name: 'Sam', contact: 'sam@example.org' }) });
    expect(screen.getByTestId(Testids.lend.borrowerSelected)).toHaveTextContent(/Lending to.*Sam.*sam@example.org/);
    expect(screen.queryByTestId(Testids.lend.borrowerContact)).toBeNull();
  });

  it('adds a new borrower inline with an optional private contact', async () => {
    renderWithTheme(<Harness />);
    await type('Alex');
    expect(options()).toEqual([]);
    const create = screen.getByTestId(Testids.lend.borrowerCreate);
    expect(create).toHaveTextContent(/Add “Alex”$/);
    await act(async () => fireEvent.press(create));
    expect(latest).toEqual({ kind: 'new', name: 'Alex', contact: '' });
    const contact = screen.getByTestId(Testids.lend.borrowerContact);
    expect(screen.getByText('Phone, email or where they live — just for you.')).toBeOnTheScreen();
    fireEvent.changeText(contact, '07700 900123');
    expect(latest).toEqual({ kind: 'new', name: 'Alex', contact: '07700 900123' });
    // Nothing is written until the loan is saved.
    expect((await loansRepo.listBorrowers(db)).map((b) => b.name)).not.toContain('Alex');
  });

  it('puts the keyboard away once someone is chosen, as the search field goes', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    renderWithTheme(<Harness />);
    await type('sa');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.lend.borrowerOption)));
    expect(dismiss).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId(Testids.lend.borrowerChange));
    await type('Alex');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.lend.borrowerCreate)));
    expect(dismiss).toHaveBeenCalledTimes(2);
    dismiss.mockRestore();
  });

  it('asks "Sam already exists — use them?" instead of adding a duplicate', async () => {
    renderWithTheme(<Harness />);
    await type('  sam ');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.lend.borrowerCreate)));
    const prompt = screen.getByTestId(Testids.lend.borrowerExisting);
    expect(prompt).toHaveTextContent(/^Sam already exists — use them\?/);
    expect(prompt.props.role).toBe('alert');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.lend.borrowerUseExisting)));
    expect(latest).toEqual({ kind: 'existing', borrower: expect.objectContaining({ name: 'Sam' }) });
  });

  it('can still add a second person with the same name on purpose', async () => {
    renderWithTheme(<Harness />);
    await type('SAM');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.lend.borrowerCreate)));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.lend.borrowerAddAnyway)));
    expect(latest).toEqual({ kind: 'new', name: 'SAM', contact: '' });
  });

  it('Change goes back to the search with the name filled in', async () => {
    renderWithTheme(<Harness />);
    await type('Alex');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.lend.borrowerCreate)));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.lend.borrowerChange)));
    await settle();
    expect(latest).toBeNull();
    expect(screen.getByTestId(Testids.lend.borrowerSearch).props.value).toBe('Alex');
  });
});
