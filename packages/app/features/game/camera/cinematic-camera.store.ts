import { createStore } from 'zustand/vanilla';
import { sanitizeKlippShot, type KlippCameraShot } from './klipp-shot-bridge.ts';

/**
 * JS-side seam for shot requests. The scene's Klipp rig reads `shot` through
 * the params getter; the store only holds and sanitises the request — the
 * camera write itself is KlippThree's. Never touches the player's
 * authoritative world position or the stored resume camera.
 */
interface CinematicCameraState {
  shot: KlippCameraShot | null;
  setShot: (shot: KlippCameraShot) => boolean;
  clear: () => void;
}
export const cinematicCameraStore = createStore<CinematicCameraState>((set) => ({
  shot: null,
  setShot: (shot) => {
    const clean = sanitizeKlippShot(shot);
    if (!clean) return false;
    set({ shot: clean });
    return true;
  },
  clear: () => set({ shot: null }),
}));
