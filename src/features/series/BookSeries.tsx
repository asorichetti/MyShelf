import { router } from 'expo-router';

import { SeriesConfirm } from '@/components/book/SeriesConfirm';
import { SeriesSection } from '@/components/book/SeriesSection';
import type { BookDetail } from '@/domain';
import { useSeriesConfirm } from '@/features/book/useSeriesConfirm';
import { Testids } from '@/testing/testids.gen';

import { useBookSeries } from './useBookSeries';
import { useSeriesOptions } from './useSeriesOptions';

/**
 * The Series section of a book's page (P04-03, P04-06): its place in the
 * series with previous and next, a link to the series, and the "Is this
 * Discworld #5?" check when the series was a guess. Renders nothing for a
 * book in no series.
 */
export function BookSeries({ book }: { book: BookDetail }) {
  const place = useBookSeries(book.id, book.seriesId, book.seriesPosition);
  const confirm = useSeriesConfirm(book.id, book.seriesId);
  const existing = useSeriesOptions();
  if (!book.series || !place) return null;
  return (
    <SeriesSection
      series={place.series}
      position={place.position}
      progress={place.progress}
      neighbours={place.neighbours}
      bookCount={place.bookCount}
      onOpenSeries={() => router.navigate({ pathname: '/series/[id]', params: { id: String(place.series.id) } })}
      onOpenBook={(id) => router.push({ pathname: '/book/[id]', params: { id: String(id) } })}
      testID={Testids.bookDetail.series}
    >
      {confirm.asking ? (
        <SeriesConfirm
          key={`${place.series.id}:${place.position ?? ''}`}
          seriesName={place.series.name}
          position={place.position}
          existing={existing}
          busy={confirm.busy}
          onYes={confirm.yes}
          onNo={confirm.no}
          onChange={confirm.change}
        />
      ) : null}
    </SeriesSection>
  );
}
