/**
 * @jest-environment jsdom
 */
import { keyActivationTarget } from '@/hooks/useKeyboardActivation.web';

function el(tag: string, role?: string, attrs: Record<string, string> = {}): HTMLElement {
  const e = document.createElement(tag);
  if (role) e.setAttribute('role', role);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  document.body.appendChild(e);
  return e;
}

const key = (target: HTMLElement, k: string, mods: Partial<KeyboardEvent> = {}) =>
  keyActivationTarget({ key: k, target, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, ...mods });

describe('keyActivationTarget (P09-01)', () => {
  it('activates a link drawn as a div with Enter, not Space', () => {
    const link = el('div', 'link');
    expect(key(link, 'Enter')).toBe(link);
    expect(key(link, ' ')).toBeNull();
  });

  it.each(['checkbox', 'radio', 'switch', 'tab', 'menuitem', 'option'])('activates a %s with Space', (role) => {
    const control = el('div', role);
    expect(key(control, ' ')).toBe(control);
    // Enter already works on these: react-native-web presses them itself.
    expect(key(control, 'Enter')).toBeNull();
  });

  it('activates a tab bar tab (a link element) with Space, and leaves Enter to the browser', () => {
    const tab = el('a', 'tab', { href: '/loans' });
    expect(key(tab, ' ')).toBe(tab);
    expect(key(tab, 'Enter')).toBeNull();
  });

  it('leaves buttons, fields, disabled controls, repeats and shortcuts alone', () => {
    expect(key(el('div', 'button'), ' ')).toBeNull();
    expect(key(el('button'), ' ')).toBeNull();
    expect(key(el('input', 'checkbox'), ' ')).toBeNull();
    expect(key(el('div', 'checkbox', { 'aria-disabled': 'true' }), ' ')).toBeNull();
    const box = el('div', 'checkbox');
    expect(key(box, ' ', { repeat: true })).toBeNull();
    expect(key(box, ' ', { ctrlKey: true })).toBeNull();
    expect(key(el('div'), 'Enter')).toBeNull();
  });
});
