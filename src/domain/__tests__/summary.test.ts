import { BRIEF_SUMMARY_MAX, briefSummary } from '../summary';

describe('briefSummary', () => {
  it('returns null for nothing', () => {
    expect(briefSummary(null)).toBeNull();
    expect(briefSummary(undefined)).toBeNull();
    expect(briefSummary('   ')).toBeNull();
    expect(briefSummary('<p></p>')).toBeNull();
  });

  it('keeps a short description whole, with whitespace collapsed', () => {
    expect(briefSummary('  Rincewind   meets\nTwoflower.  ')).toBe('Rincewind meets Twoflower.');
  });

  it('strips HTML and keeps only the first paragraph', () => {
    const html = '<p>Death takes on an <b>apprentice</b>.</p><p>Second paragraph about Binky.</p>';
    expect(briefSummary(html)).toBe('Death takes on an apprentice.');
    expect(briefSummary('First paragraph here.\n\nSecond paragraph.')).toBe('First paragraph here.');
  });

  it('skips a heading-like first line', () => {
    expect(briefSummary('Book One\n\nA young wizard sets out to find his lost shadow before it finds him.')).toBe(
      'A young wizard sets out to find his lost shadow before it finds him.',
    );
  });

  it('cuts a long paragraph at the last sentence boundary within the limit', () => {
    const sentence = 'This sentence is exactly fifty characters long ok. ';
    const long = sentence.repeat(20).trim();
    const out = briefSummary(long)!;
    expect(out.length).toBeLessThanOrEqual(BRIEF_SUMMARY_MAX);
    expect(out.endsWith('ok.')).toBe(true);
    expect(out.length).toBeGreaterThan(BRIEF_SUMMARY_MAX - sentence.length);
  });

  it('treats ?, ! and closing quotes as sentence ends', () => {
    const text = `${'Is it magic? '.repeat(30)}“Yes!” she said. ${'More words follow here. '.repeat(20)}`;
    const out = briefSummary(text, 60)!;
    expect(out).toBe('Is it magic? Is it magic? Is it magic? Is it magic?');
    expect(briefSummary('He said “Run.” Then he ran away quickly.', 20)).toBe('He said “Run.”');
  });

  it('cuts a single overlong sentence at a word and adds an ellipsis', () => {
    const out = briefSummary(`${'word '.repeat(200)}end.`, 100)!;
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith('word…')).toBe(true);
  });

  it('does not treat a decimal point as a sentence end', () => {
    expect(briefSummary('Version 2.5 of the story. And more text follows here.', 30)).toBe('Version 2.5 of the story.');
  });
});
