import { helpContent } from '../helpContent';
import { helpScreens, tips } from '../tips';

describe('help content', () => {
  it.each(helpScreens)('%s has a help tip and a help sheet', (screen) => {
    expect(tips.find((t) => t.id === `help-${screen}`)?.action).toEqual({ label: 'More help', id: 'help-more' });
    const content = helpContent[screen];
    expect(content.title.length).toBeGreaterThan(0);
    expect(content.sections.length).toBeGreaterThanOrEqual(2);
    for (const s of content.sections) {
      expect(s.heading.length).toBeLessThanOrEqual(40);
      expect(s.body.length).toBeLessThanOrEqual(240);
      expect(s.body).not.toMatch(/'/);
    }
  });

  it('has nothing for screens without a help button', () => {
    expect(Object.keys(helpContent).sort()).toEqual([...helpScreens].sort());
  });

  it('explains the things the card names', () => {
    const all = JSON.stringify(helpContent);
    for (const q of ['Where is the ISBN?', 'What is an edition?', 'How do series gaps work?']) expect(all).toContain(q);
  });
});
