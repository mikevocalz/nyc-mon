'use client';

import { SkylineDivider } from '@acme/ui';
import { useDistrictStore } from '@acme/spatial';

/** A skyline band between home sections, in the district picked in the hero. */
export function DistrictDivider({ seed }: { seed: number }) {
  const district = useDistrictStore((s) => s.district);
  return <SkylineDivider district={district} seed={seed} size="md" />;
}
