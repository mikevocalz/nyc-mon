import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Paragraph } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { DirectionCanon } from '../../../../../components/review/hero/DirectionCanon';
import { DirectionCity } from '../../../../../components/review/hero/DirectionCity';
import { DirectionCompanion } from '../../../../../components/review/hero/DirectionCompanion';
import { HeroDirectionSwitcher } from '../../../../../components/review/hero/HeroDirectionSwitcher';
import { REVIEW_COPY, reviewRoutesEnabled } from '../../../../../components/review/hero/copy';

/**
 * WEB-02 internal review: three hero directions, one at a time
 * (docs/design/site/HERO_DIRECTIONS.md). Dev-only. It 404s unless
 * NYCMON_REVIEW_ROUTES=1, is never indexed or followed, and nothing links to
 * it: not the nav, not the footer, not the sitemap. The public hero
 * (components/home/HomeHero.tsx) is untouched.
 *
 * The flag is read when the page renders. Under cacheComponents a production
 * build prerenders it, so a build made without the flag ships a 404 here.
 */
export const metadata: Metadata = {
  title: REVIEW_COPY.pageTitle,
  robots: { index: false, follow: false },
};

export default function Page() {
  if (!reviewRoutesEnabled(process.env)) notFound();
  return (
    <View className="w-full gap-4 pt-6" testID="review-hero-page">
      <View className="mx-auto w-full max-w-screen-xl gap-2 px-4 sm:px-6 lg:px-8">
        {/* The page's one h1. Each direction's headline is an h2 here and becomes the h1 when it ships. */}
        <Heading level={1} className="my-0 font-display text-display-sm uppercase leading-heading text-text">
          {REVIEW_COPY.pageTitle}
        </Heading>
        <Paragraph className="my-0 max-w-content-measure text-sm leading-6 text-text-secondary">{REVIEW_COPY.notice}</Paragraph>
      </View>
      <HeroDirectionSwitcher
        directions={{
          a: <DirectionCanon level={2} />,
          b: <DirectionCompanion level={2} />,
          c: <DirectionCity level={2} />,
        }}
      />
    </View>
  );
}
