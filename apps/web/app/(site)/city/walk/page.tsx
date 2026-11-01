import type { Metadata } from 'next';
import { CityWalkScreen } from '@acme/app/features/game/city-walk/CityWalkScreen.tsx';
import { CITY_WALK_COPY } from '@acme/app/features/game/city-walk/copy.ts';
import { WAITLIST_CTA } from '../../../../components/site/nav';

// Public on purpose, outside the app preview gate (lib/app-preview.ts): the walk is the Game world with a guest
// camera and no account, data or demo content behind it. Decision record: docs/implementation/city-walk-web.md.
export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | Walk the city' },
  description: CITY_WALK_COPY.intro,
  alternates: { canonical: '/city/walk' },
};

export default function CityWalkPage() {
  return <CityWalkScreen getAppHref={WAITLIST_CTA.href} />;
}
