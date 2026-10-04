import { create } from 'zustand';
import type { District } from '@acme/ui';

export type { District };

type DistrictState = {
  /** The district the home screen and the immersive scene both show. */
  district: District;
  /** Whether the Viro city view is mounted below the hero. */
  cityOpen: boolean;
  setDistrict: (district: District) => void;
  setCityOpen: (open: boolean) => void;
};

/**
 * Shared between the 2D home screen and the immersive scene, so a district
 * picked on the phone is the one standing around you in the headset.
 */
export const useDistrictStore = create<DistrictState>((set) => ({
  district: 'midtown',
  cityOpen: false,
  setDistrict: (district) => set({ district }),
  setCityOpen: (cityOpen) => set({ cityOpen }),
}));

export const districtState = useDistrictStore;
