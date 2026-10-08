'use client';

import { StudioExperience } from './StudioExperience.web';
import { DistrictScene } from './DistrictScene';

/** Viro Web Renderer preview of the same DistrictScene the headsets run. */
export function SpatialViroExperience() {
  return <StudioExperience scene="district" fallback={DistrictScene} />;
}
