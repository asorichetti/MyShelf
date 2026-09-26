import { fireEvent, screen } from '@testing-library/react-native';

import { ReminderSwitch } from '@/components/loans/ReminderSwitch';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

describe('ReminderSwitch', () => {
  it('is a named switch that reports its state and flips on press', () => {
    const onChange = jest.fn();
    renderWithTheme(<ReminderSwitch value={false} onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'Remind me when loans are due' });
    expect(toggle.props.testID).toBe(Testids.reminders.toggle);
    expect(toggle).not.toBeChecked();
    fireEvent.press(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows why it is off, and can be disabled', () => {
    const onChange = jest.fn();
    renderWithTheme(<ReminderSwitch value={false} onChange={onChange} disabled note="Reminders work in the Android app." />);
    expect(screen.getByTestId(Testids.reminders.note)).toHaveTextContent('Reminders work in the Android app.');
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
