'use client';

import { SkylineDivider } from '@acme/ui';
import { useDistrictStore } from '@acme/spatial/district';

/** A still skyline band between home sections, in the district picked in the hero (PS-010: one live canvas at a time). */
export function DistrictDivider({ seed }: { seed: number }) {
  const district = useDistrictStore((s) => s.district);
  return <SkylineDivider district={district} seed={seed} size="md" still />;
}
