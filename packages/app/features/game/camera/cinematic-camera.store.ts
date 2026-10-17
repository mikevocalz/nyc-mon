import { createStore } from 'zustand/vanilla';
import { validKlippShot, type KlippCameraShot, type NycMonShot } from './klipp-shot-bridge.ts';

/**
 * Temporary seam for a future @pmndrs/klipp v0.14 coordinator. Never touches
 * player's authoritative world position or the stored resume camera.
 */
interface CinematicState {
  shot: KlippCameraShot | null;
  name: NycMonShot | null;
  setShot: (name: NycMonShot, shot: KlippCameraShot | null) => boolean;
  clear: () => void;
}
export const cinematicCameraStore = createStore<CinematicState>((set) => ({
  shot:null,
  name:null,
  setShot:(name,shot)=>{
    const validated=validKlippShot(shot);
    if (!validated) return false;
    set({name,shot:validated});
    return true;
  },
  clear:()=>set({name:null,shot:null}),
}));
