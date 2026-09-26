import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { DateField } from '@/components/ui';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const picker = { has: false, next: null as string | null, requests: [] as unknown[] };
jest.mock('@/components/ui/openDatePicker', () => ({
  get hasDatePicker() {
    return picker.has;
  },
  openDatePicker: async (request: unknown) => {
    picker.requests.push(request);
    return picker.next;
  },
}));

beforeEach(() => {
  picker.has = false;
  picker.next = null;
  picker.requests = [];
});

function Harness({ initial = '', onChange = jest.fn(), errorText }: { initial?: string; onChange?: jest.Mock; errorText?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField
        label="Due back"
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
        min="2026-06-01"
        max="2026-12-31"
        errorText={errorText}
        testID={Testids.lend.dueOn}
      />
      <DateField label="Mirror" value={value} onChange={setValue} />
    </>
  );
}

describe('DateField', () => {
  it('is a labelled text field showing the date day-first, read back in words', () => {
    renderWithTheme(<Harness initial="2026-10-12" />);
    const input = screen.getByLabelText('Due back');
    expect(input.props.testID).toBe(Testids.lend.dueOn);
    expect(input.props.value).toBe('12/10/2026');
    expect(screen.getAllByText('12 Oct 2026')).toHaveLength(2);
  });

  it('turns typed dates into YYYY-MM-DD and passes other text through as typed', () => {
    const onChange = jest.fn();
    renderWithTheme(<Harness onChange={onChange} />);
    fireEvent.changeText(screen.getByLabelText('Due back'), '12 Oct 2026');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-12');
    // The other field follows the value, the typing field keeps what was typed.
    expect(screen.getByLabelText('Due back').props.value).toBe('12 Oct 2026');
    expect(screen.getByLabelText('Mirror').props.value).toBe('12/10/2026');
    fireEvent.changeText(screen.getByLabelText('Due back'), '31/02/2026');
    expect(onChange).toHaveBeenLastCalledWith('31/02/2026');
    fireEvent.changeText(screen.getByLabelText('Due back'), '  ');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('follows a value set from outside', () => {
    renderWithTheme(<Harness initial="2026-06-01" />);
    fireEvent.changeText(screen.getByLabelText('Mirror'), '2026-07-04');
    expect(screen.getByLabelText('Due back').props.value).toBe('04/07/2026');
  });

  it('shows an error as an alert and marks the field invalid', () => {
    renderWithTheme(<Harness errorText="The due date can’t be before the day you lent it." />);
    expect(screen.getByRole('alert')).toHaveTextContent('The due date can’t be before the day you lent it.');
    expect(screen.getByLabelText('Due back').props['aria-invalid']).toBe(true);
  });

  it('offers no calendar button where the platform has no picker', () => {
    renderWithTheme(<Harness />);
    expect(screen.queryByRole('button', { name: /from a calendar/ })).toBeNull();
  });

  it('opens the platform calendar within the limits and takes its date', async () => {
    picker.has = true;
    picker.next = '2026-08-09';
    const onChange = jest.fn();
    renderWithTheme(<Harness initial="2026-07-01" onChange={onChange} />);
    const button = screen.getAllByRole('button', { name: 'Choose due back from a calendar' })[0];
    await act(async () => fireEvent.press(button));
    expect(picker.requests).toEqual([{ value: '2026-07-01', min: '2026-06-01', max: '2026-12-31' }]);
    expect(onChange).toHaveBeenLastCalledWith('2026-08-09');
    expect(screen.getByLabelText('Due back').props.value).toBe('09/08/2026');
  });

  it('keeps the value when the calendar is dismissed', async () => {
    picker.has = true;
    const onChange = jest.fn();
    renderWithTheme(<Harness initial="2026-07-01" onChange={onChange} />);
    await act(async () => fireEvent.press(screen.getAllByRole('button', { name: 'Choose due back from a calendar' })[0]));
    expect(onChange).not.toHaveBeenCalled();
  });
});
