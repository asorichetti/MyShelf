import { missingDetailChanges, type FieldChange } from '@/domain';

const change = (field: FieldChange['field'], kind: FieldChange['kind'], suggested = kind === 'add'): FieldChange => ({ field, kind, from: kind === 'add' ? '' : 'old', to: 'new', suggested });

describe('missingDetailChanges', () => {
  it('offers only additions to the fields a spreadsheet lacks, all ticked', () => {
    const out = missingDetailChanges([
      change('cover', 'add'),
      change('summary', 'add'),
      change('pages', 'add'),
      change('publisher', 'add'),
      change('series', 'add'),
      change('title', 'add'),
      change('year', 'add'),
      change('language', 'add'),
    ]);
    expect(out.map((c) => c.field)).toEqual(['cover', 'summary', 'pages', 'publisher', 'series']);
    expect(out.every((c) => c.suggested)).toBe(true);
  });

  it('never replaces what the file held', () => {
    expect(missingDetailChanges([change('pages', 'change'), change('publisher', 'change'), change('summary', 'change'), change('series', 'change'), change('authors', 'change')])).toEqual([]);
  });

  it("adds genres only when every genre the book has stays", () => {
    expect(missingDetailChanges([change('genres', 'change', true)]).map((c) => c.field)).toEqual(['genres']);
    expect(missingDetailChanges([change('genres', 'change', false)])).toEqual([]);
    expect(missingDetailChanges([change('genres', 'add')]).map((c) => c.field)).toEqual(['genres']);
  });
});
