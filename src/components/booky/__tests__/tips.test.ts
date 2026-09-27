import { bookCount, formatTip, placeholders } from '../format';
import { bookyTriggers, helpScreens, tipById, tips } from '../tips';

/** The triggers in PLAN §8's table; each needs at least one tip. */
const planTriggers = ['app-first-launch', 'shelf-empty', 'scan-opened', 'scan-idle', 'lookup-none', 'book-added', 'offline-queued', 'loan-overdue', 'series-gap', 'help-requested'];

describe('tip catalogue', () => {
  it('has unique ids', () => {
    const ids = tips.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a tip for every trigger in the PLAN table', () => {
    for (const trigger of planTriggers) expect(tips.some((t) => t.trigger === trigger)).toBe(true);
  });

  it('only uses known triggers', () => {
    for (const t of tips) expect(bookyTriggers).toContain(t.trigger);
  });

  it('has help for every screen with a help button', () => {
    for (const screen of helpScreens) expect(tips.some((t) => t.trigger === 'help-requested' && t.when?.screen === screen)).toBe(true);
  });

  it.each(tips.map((t) => [t.id, t] as const))('%s: sample data fills every placeholder', (_, tip) => {
    for (const name of [...placeholders(tip.text), ...(tip.action && 'href' in tip.action ? placeholders(tip.action.href) : [])]) {
      expect(tip.sample?.[name]).toBeDefined();
    }
  });

  it.each(tips.map((t) => [t.id, t] as const))('%s: at most 120 characters once filled in, and no leftovers', (_, tip) => {
    const text = formatTip(tip.text, tip.sample);
    expect(text.length).toBeLessThanOrEqual(120);
    expect(text).not.toMatch(/[{}]/);
    expect(text.length).toBeGreaterThan(0);
    if (tip.title) expect(tip.title.length).toBeLessThanOrEqual(30);
  });

  it.each(tips.map((t) => [t.id, t] as const))('%s: friendly copy (no blame, no shouting, British spelling)', (_, tip) => {
    const text = formatTip(tip.text, tip.sample);
    expect(text).not.toMatch(/\byou (did|made|scanned) (it )?wrong|\berror\b|\binvalid\b|\bfailed\b/i);
    expect(text).not.toMatch(/!{2,}|[A-Z]{5,}/);
    expect(text).not.toMatch(/\b(color|catalog|favorite)\b/i);
    expect(text).not.toMatch(/'/); // curly apostrophes only
  });

  it('keeps help available in every mode and nudges out of Quiet', () => {
    for (const tip of tips.filter((t) => t.kind === 'help')) expect(tip.modes).toEqual(['helpful', 'quiet']);
    expect(tipById('book-added').modes).toEqual(['helpful']);
    expect(tipById('loan-overdue').modes).toEqual(['helpful']);
    expect(tipById('shelf-empty').modes).toContain('quiet');
  });

  it('throws for an unknown tip id', () => {
    expect(() => tipById('nope')).toThrow('Booky has no tip "nope"');
  });
});

describe('formatTip', () => {
  it('fills placeholders', () => {
    expect(formatTip('Shelved! That’s {books}.', { books: bookCount(12) })).toBe('Shelved! That’s 12 books.');
    expect(formatTip('{a} and {a}', { a: 1 })).toBe('1 and 1');
  });

  it('drops a missing value rather than showing the placeholder', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(formatTip('Hello {name}, welcome.', {})).toBe('Hello , welcome.');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('name');
    warn.mockRestore();
  });

  it('lists placeholders once each', () => {
    expect(placeholders('{a} {b} {a}')).toEqual(['a', 'b']);
    expect(placeholders('none')).toEqual([]);
  });

  it('counts books', () => {
    expect(bookCount(1)).toBe('1 book');
    expect(bookCount(0)).toBe('0 books');
  });
});
