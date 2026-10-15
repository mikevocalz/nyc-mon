import { createStore } from 'zustand/vanilla';
import type { CityCamera } from './city-scene.ts';

export const INITIAL_CITY_CAMERA: Readonly<CityCamera> = Object.freeze({ x: 0, z: 0, yaw: 0, distance: 220 });
const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type CityCameraAction =
  | { type: 'pan'; right: number; forward: number }
  | { type: 'orbit'; radians: number }
  | { type: 'zoom'; factor: number }
  | { type: 'reset' };

/** Screen-relative metre deltas allow touch and accessible buttons to share controls. */
export function moveCityCamera(camera: CityCamera, action: CityCameraAction): CityCamera {
  if (action.type === 'reset') return { ...INITIAL_CITY_CAMERA };
  if (![camera.x, camera.z, camera.yaw, camera.distance].every(Number.isFinite)) return { ...INITIAL_CITY_CAMERA };
  switch (action.type) {
    case 'pan': {
      if (![action.right, action.forward].every(Number.isFinite)) return camera;
      const right = clamp(action.right, -500, 500);
      const forward = clamp(action.forward, -500, 500);
      return {
        ...camera,
        x: clamp(camera.x + Math.cos(camera.yaw) * right - Math.sin(camera.yaw) * forward, -2000, 2000),
        z: clamp(camera.z - Math.sin(camera.yaw) * right - Math.cos(camera.yaw) * forward, -2000, 2000),
      };
    }
    case 'orbit':
      if (!Number.isFinite(action.radians)) return camera;
      return { ...camera, yaw: ((camera.yaw % TAU + action.radians % TAU) % TAU + TAU) % TAU };
    case 'zoom':
      if (!Number.isFinite(action.factor) || action.factor <= 0) return camera;
      return { ...camera, distance: clamp(camera.distance * clamp(action.factor, 0.1, 10), 30, 3000) };
  }
}

/** Owned by the game shell, separate from the player's persisted Mon save. */
export function createCityCameraStore() {
  return createStore<{ camera: CityCamera; move: (action: CityCameraAction) => void }>((set) => ({
    camera: { ...INITIAL_CITY_CAMERA },
    move: (action) => set((state) => ({ camera: moveCityCamera(state.camera, action) })),
  }));
}
