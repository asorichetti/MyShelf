import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { StarRating, StarRatingDisplay } from '@/components/ui';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

function Harness({ initial = null, onChange }: { initial?: number | null; onChange?: (r: number | null) => void }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <StarRating
      value={value}
      onChange={(r) => {
        setValue(r);
        onChange?.(r);
      }}
    />
  );
}

const control = () => screen.getByTestId(Testids.rating.control);
const key = (k: string, extra: Record<string, unknown> = {}) => {
  const preventDefault = jest.fn();
  act(() => control().props.onKeyDown({ key: k, preventDefault, ...extra }));
  return preventDefault;
};

describe('StarRating', () => {
  it('is one adjustable control named "Rating" with its value in words', () => {
    renderWithTheme(<Harness initial={4} />);
    const c = control();
    expect(c.props.role).toBe('slider');
    expect(c.props.accessible).toBe(true);
    expect(c.props.focusable).toBe(true);
    expect(c.props['aria-label']).toBe('Rating');
    expect(c.props['aria-valuemin']).toBe(0);
    expect(c.props['aria-valuemax']).toBe(5);
    expect(c.props['aria-valuenow']).toBe(4);
    expect(c.props['aria-valuetext']).toBe('4 out of 5 stars');
    expect(c.props.accessibilityValue).toEqual({ min: 0, max: 5, now: 4, text: '4 out of 5 stars' });
    expect(c.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['increment', 'decrement']);
  });

  it('says "Not rated" when there is no rating', () => {
    renderWithTheme(<Harness />);
    expect(control().props['aria-valuetext']).toBe('Not rated');
    expect(control().props['aria-valuenow']).toBe(0);
  });

  it('hides the five stars from screen readers and keeps them out of the tab order, each a 48 dp target', () => {
    renderWithTheme(<Harness />);
    const stars = screen.getAllByTestId(Testids.rating.star, { includeHiddenElements: true });
    expect(stars).toHaveLength(5);
    for (const s of stars) {
      expect(s.props.tabIndex).toBe(-1);
      expect(s).not.toBeVisible();
    }
    const style = Object.assign({}, ...[stars[0].props.style].flat(Infinity).filter(Boolean));
    expect(style).toMatchObject({ width: 48, height: 48 });
  });

  it('a tap sets the rating; a tap on the current star clears it', () => {
    const onChange = jest.fn();
    renderWithTheme(<Harness onChange={onChange} />);
    const star = (n: number) => screen.getAllByTestId(Testids.rating.star, { includeHiddenElements: true })[n - 1];
    fireEvent.press(star(3));
    expect(onChange).toHaveBeenLastCalledWith(3);
    expect(control().props['aria-valuetext']).toBe('3 out of 5 stars');
    fireEvent.press(star(5));
    expect(onChange).toHaveBeenLastCalledWith(5);
    fireEvent.press(star(5));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(control().props['aria-valuetext']).toBe('Not rated');
  });

  it('TalkBack’s increment and decrement add or take away a star, down to not rated', () => {
    const onChange = jest.fn();
    renderWithTheme(<Harness initial={4} onChange={onChange} />);
    const act = (actionName: string) => fireEvent(control(), 'accessibilityAction', { nativeEvent: { actionName } });
    act('increment');
    expect(onChange).toHaveBeenLastCalledWith(5);
    act('increment');
    expect(onChange).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 5; i++) act('decrement');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(control().props['aria-valuetext']).toBe('Not rated');
  });

  it('arrow keys, Home, End, digits and Delete work on the web', () => {
    const onChange = jest.fn();
    renderWithTheme(<Harness initial={2} onChange={onChange} />);
    expect(key('ArrowRight')).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(3);
    key('ArrowUp');
    expect(onChange).toHaveBeenLastCalledWith(4);
    key('ArrowLeft');
    expect(onChange).toHaveBeenLastCalledWith(3);
    key('End');
    expect(onChange).toHaveBeenLastCalledWith(5);
    key('1');
    expect(onChange).toHaveBeenLastCalledWith(1);
    key('Home');
    expect(onChange).toHaveBeenLastCalledWith(null);
    key('4');
    key('Delete');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('leaves other keys, and shortcuts, to the browser', () => {
    const onChange = jest.fn();
    renderWithTheme(<Harness initial={2} onChange={onChange} />);
    expect(key('Tab')).not.toHaveBeenCalled();
    expect(key('ArrowRight', { ctrlKey: true })).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has a "Clear rating" button, disabled when there is nothing to clear', () => {
    const onChange = jest.fn();
    renderWithTheme(<Harness initial={3} onChange={onChange} />);
    const clear = screen.getByRole('button', { name: 'Clear rating' });
    fireEvent.press(clear);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('button', { name: 'Clear rating' })).toBeDisabled();
  });

  it('does nothing while disabled', () => {
    const onChange = jest.fn();
    renderWithTheme(<StarRating value={2} onChange={onChange} disabled />);
    key('ArrowRight');
    fireEvent(control(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(control().props.focusable).toBe(false);
  });
});

describe('StarRatingDisplay', () => {
  it('draws the stars, hidden from screen readers (the row names the rating)', () => {
    renderWithTheme(<StarRatingDisplay value={4} />);
    const display = screen.getByTestId(Testids.rating.display, { includeHiddenElements: true });
    expect(display.props['aria-hidden']).toBe(true);
    expect(display).not.toBeVisible();
  });

  it('draws nothing when not rated', () => {
    renderWithTheme(<StarRatingDisplay value={null} />);
    expect(screen.queryByTestId(Testids.rating.display, { includeHiddenElements: true })).toBeNull();
  });
});
