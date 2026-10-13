import { Text } from '@acme/ui/html';
import { REVIEW_COPY } from './copy';

/** Headline level: 1 in a real page, 2 inside the review page (whose h1 names the review). */
export type HeadlineLevel = 1 | 2;

/**
 * The "Concept art" tag pinned on creature art (PS-028: generated stand-ins
 * for final renders). Real text, so a screen reader hears it with the figure.
 */
export function ConceptArtTag({ className = '' }: { className?: string }) {
  return (
    <Text className={`absolute z-10 bg-signage-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-signage-black ${className}`}>
      {REVIEW_COPY.conceptArt}
    </Text>
  );
}

/** The one shell every direction shares: a daylit concrete surface, full width (Decision #4). */
export const HERO_SURFACE = 'w-full border-b-2 border-ink-950 bg-concrete-100';

/** The 80rem home grid's gutters, matching the live hero. */
export const HERO_GUTTERS = 'mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8';
