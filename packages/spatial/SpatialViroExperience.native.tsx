'use client';

import { StudioExperience } from './StudioExperience.native';
import { DistrictScene } from './DistrictScene';
import { useDistrictStore } from './districtStore';

const close = () => useDistrictStore.getState().setCityOpen(false);

/**
 * Inline city view. `StudioExperience` decides where the scene comes from:
 * the Studio project once a `district` scene is authored there, the code-first
 * `DistrictScene` until then. On Quest the XR navigator hands the scene to
 * Viro's VR activity. PICO never reaches here for immersion: stock Viro sends
 * PICO down its AR path, so PICO enters through expo-pico's
 * enterImmersiveScene() with the scene registered in apps/mobile/index.js.
 * Phones and PICO's 2D panel get the flat preview.
 */
export function SpatialViroExperience() {
  return (
    <StudioExperience
      scene="district"
      fallback={DistrictScene}
      onExitViro={close}
    />
  );
}
