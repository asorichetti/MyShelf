import { neighboursInSeries, type PositionedBook } from '@/domain';

const b = (id: number, position: number | null, title = `Book ${id}`): PositionedBook => ({ id, title, position });
const shape = (n: ReturnType<typeof neighboursInSeries>) => ({
  previous: n.previous && (n.previous.kind === 'owned' ? `book ${n.previous.book.id}` : `missing ${n.previous.position}`),
  next: n.next && (n.next.kind === 'owned' ? `book ${n.next.book.id}` : `missing ${n.next.position}`),
});

describe('neighboursInSeries', () => {
  const discworld = [b(1, 1), b(2, 2), b(4, 4)];

  it('gives the owned books either side', () => {
    expect(shape(neighboursInSeries(discworld, 2, 4))).toEqual({ previous: 'book 1', next: 'missing 3' });
  });

  it('names the missing whole number next to a book', () => {
    expect(shape(neighboursInSeries(discworld, 4, 4))).toEqual({ previous: 'missing 3', next: null });
    expect(shape(neighboursInSeries(discworld, 4, 9))).toEqual({ previous: 'missing 3', next: 'missing 5' });
  });

  it('handles the first and last book', () => {
    expect(shape(neighboursInSeries(discworld, 1, 4))).toEqual({ previous: null, next: 'book 2' });
    expect(shape(neighboursInSeries([b(1, 1)], 1, 1))).toEqual({ previous: null, next: null });
  });

  it('orders fractional positions between whole ones', () => {
    const books = [b(1, 1), b(2, 2), b(25, 2.5), b(3, 3)];
    expect(shape(neighboursInSeries(books, 2, 3))).toEqual({ previous: 'book 1', next: 'book 25' });
    expect(shape(neighboursInSeries(books, 25, 3))).toEqual({ previous: 'book 2', next: 'book 3' });
    expect(shape(neighboursInSeries(books, 3, 3))).toEqual({ previous: 'book 25', next: null });
  });

  it('says #3 is missing after a 2.5 when there is no #3', () => {
    expect(shape(neighboursInSeries([b(2, 2), b(25, 2.5)], 25, 4))).toEqual({ previous: 'book 2', next: 'missing 3' });
  });

  it('keeps a prequel (0.5) before #1', () => {
    expect(shape(neighboursInSeries([b(5, 0.5), b(1, 1)], 1, 1))).toEqual({ previous: 'book 5', next: null });
  });

  it('gives an unnumbered or unknown book no neighbours', () => {
    expect(neighboursInSeries([...discworld, b(9, null)], 9, 4)).toEqual({ previous: null, next: null });
    expect(neighboursInSeries(discworld, 99, 4)).toEqual({ previous: null, next: null });
  });

  it('points past a long gap to the next owned book when the length is unknown', () => {
    expect(shape(neighboursInSeries([b(1, 1), b(5, 5)], 1, null))).toEqual({ previous: null, next: 'book 5' });
  });
});
