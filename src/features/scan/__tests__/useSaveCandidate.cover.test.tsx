import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { booksRepo, StaticDatabaseProvider, type Db } from '@/db';
import { attachCoverFromCandidate } from '@/features/covers';
import { subscribe } from '@/features/events';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata } from '@/testing/fixtureMetadata';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

import { acceptCoverPhoto, clearCoverPhotoOffers, coverPhotoOffer, declineCoverPhoto, offerPhotoIfNoCover } from '../coverPhotoOffer';
import { CoverPhotoOfferHost } from '../CoverPhotoOfferHost';
import { discardPhoto } from '../tempPhoto';
import { saveCandidate } from '../useSaveCandidate';

jest.mock('@/features/covers', () => ({ ...jest.requireActual('@/features/covers'), attachCoverFromCandidate: jest.fn() }));
jest.mock('../tempPhoto', () => ({ discardPhoto: jest.fn() }));
jest.mock('@/services/covers', () => ({
  ...jest.requireActual('@/services/covers'),
  storeCoverFile: jest.fn((bookId: number) => `file:///documents/covers/${bookId}.jpg`),
}));
jest.mock('@/services/recognition', () => ({
  ...jest.requireActual('@/services/recognition'),
  coverFromPhoto: jest.fn(async () => 'file:///cache/cover-photos/cropped.jpg'),
}));

const photo = 'file:///cache/Camera/cover.jpg';
const focus = { x: 100, y: 150, width: 800, height: 1200 };
let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  clearCoverPhotoOffers();
  jest.mocked(discardPhoto).mockClear();
  jest.mocked(attachCoverFromCandidate).mockReset();
});
afterEach(() => db.close());

async function saveWith(cover: Awaited<ReturnType<typeof attachCoverFromCandidate>>) {
  jest.mocked(attachCoverFromCandidate).mockResolvedValue(cover);
  const candidate = (await createFixtureMetadata().service.lookupIsbn(OL_BOOKS.colourOfMagic)).candidates[0];
  const saved = await saveCandidate(db, candidate);
  offerPhotoIfNoCover(saved, photo, focus);
  await saved.cover;
  await Promise.resolve();
  return saved;
}

describe('the cover photo when no online cover exists (P03-14)', () => {
  it('no online cover: the photo is offered for the book, and kept', async () => {
    const saved = await saveWith({ status: 'none', tried: [] });
    expect(coverPhotoOffer(saved.id)).toBe(photo);
    expect(discardPhoto).not.toHaveBeenCalled();
  });

  it.each([
    ['an online cover was found', { status: 'attached', coverUri: 'file:///documents/covers/1.jpg', cover: {} as never }],
    ['offline', { status: 'offline' }],
    ['the search failed', { status: 'failed', error: 'HTTP 500' }],
  ] as const)('%s: no offer, and the photo is deleted', async (_name, cover) => {
    const saved = await saveWith(cover);
    expect(coverPhotoOffer(saved.id)).toBeNull();
    expect(discardPhoto).toHaveBeenCalledWith(photo);
  });

  it('confirm: an upright 2:3 copy, cropped around the text, becomes the cover; the photo and the copy are deleted', async () => {
    const saved = await saveWith({ status: 'none', tried: [] });
    const changed = jest.fn();
    const off = subscribe('library-changed', changed);
    await expect(acceptCoverPhoto(db, saved.id)).resolves.toBe(`file:///documents/covers/${saved.id}.jpg`);
    const { coverFromPhoto } = jest.requireMock<typeof import('@/services/recognition')>('@/services/recognition');
    const { storeCoverFile } = jest.requireMock<typeof import('@/services/covers')>('@/services/covers');
    expect(coverFromPhoto).toHaveBeenCalledWith(photo, focus);
    expect(storeCoverFile).toHaveBeenCalledWith(saved.id, 'file:///cache/cover-photos/cropped.jpg');
    expect((await booksRepo.getBook(db, saved.id))?.coverUri).toBe(`file:///documents/covers/${saved.id}.jpg`);
    expect(discardPhoto).toHaveBeenCalledWith(photo);
    expect(discardPhoto).toHaveBeenCalledWith('file:///cache/cover-photos/cropped.jpg');
    expect(coverPhotoOffer(saved.id)).toBeNull();
    expect(changed).toHaveBeenCalled();
    off();
  });

  it('decline: the offer goes and the photo is deleted', async () => {
    const saved = await saveWith({ status: 'none', tried: [] });
    declineCoverPhoto(saved.id);
    expect(coverPhotoOffer(saved.id)).toBeNull();
    expect(discardPhoto).toHaveBeenCalledWith(photo);
    expect((await booksRepo.getBook(db, saved.id))?.coverUri).toBeFalsy();
  });

  describe('on the book page', () => {
    const renderHost = (bookId: number) =>
      renderWithTheme(
        <StaticDatabaseProvider db={db}>
          <CoverPhotoOfferHost bookId={bookId} title="The Colour of Magic" />
        </StaticDatabaseProvider>,
      );

    it('shows nothing without an offer', async () => {
      const saved = await saveWith({ status: 'attached', coverUri: 'x', cover: {} as never });
      renderHost(saved.id);
      expect(screen.queryByTestId(Testids.coverPhoto.offer)).toBeNull();
    });

    it('Booky offers the photo; "Use my photo" makes it the cover', async () => {
      const saved = await saveWith({ status: 'none', tried: [] });
      renderHost(saved.id);
      expect(screen.getByText('I couldn’t find a cover for “The Colour of Magic” online. Shall I use your photo?')).toBeOnTheScreen();
      expect(screen.getByLabelText('Your photo of the cover of The Colour of Magic')).toBeOnTheScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId(Testids.coverPhoto.use));
      });
      await waitFor(() => expect(screen.queryByTestId(Testids.coverPhoto.offer)).toBeNull());
      expect((await booksRepo.getBook(db, saved.id))?.coverUri).toBe(`file:///documents/covers/${saved.id}.jpg`);
    });

    it('"No thanks" dismisses it', async () => {
      const saved = await saveWith({ status: 'none', tried: [] });
      renderHost(saved.id);
      act(() => fireEvent.press(screen.getByTestId(Testids.coverPhoto.decline)));
      expect(screen.queryByTestId(Testids.coverPhoto.offer)).toBeNull();
      expect(discardPhoto).toHaveBeenCalledWith(photo);
    });
  });
});
