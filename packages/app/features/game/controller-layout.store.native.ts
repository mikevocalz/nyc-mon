'use client';
import { useStore } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import {
  createControllerLayoutStore,
  readControllerLayouts,
  type ControllerLayoutState,
} from './controller-layout.store.shared.ts';

// MMKV, instance id `controller-layout`. Its reads are synchronous, so the
// very first frame already places the controls where the player left them.
const storage = createMMKV({ id: 'controller-layout' });
export const controllerLayoutStore = createControllerLayoutStore(storage, readControllerLayouts(storage));

export function useControllerLayout<T>(selector: (state: ControllerLayoutState) => T): T {
  return useStore(controllerLayoutStore, selector);
}

/** Actions for gesture handlers and the settings screen, outside React render. */
export const controllerLayoutActions = {
  setOffset: controllerLayoutStore.getState().setOffset,
  setScale: controllerLayoutStore.getState().setScale,
  reset: controllerLayoutStore.getState().reset,
};
