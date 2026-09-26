import { screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { SettingsNotice } from '@/components/settings/SettingsControls';
import { renderWithTheme } from '@/testing/render';

describe('SettingsNotice (P09-01)', () => {
  it('takes the screen reader’s focus when shown as a result that replaced its button', () => {
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    renderWithTheme(
      <SettingsNotice tone="success" title="Imported 20 books" testID="report" focusOnShow>
        Covers are on their way.
      </SettingsNotice>,
    );
    expect(send).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(screen.getByTestId('report').props.role).toBe('status');
    send.mockRestore();
  });

  it('leaves focus alone otherwise', () => {
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    renderWithTheme(<SettingsNotice title="Backup saved">Keep it safe.</SettingsNotice>);
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
  });
});
