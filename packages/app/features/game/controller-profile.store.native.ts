'use client';
import { useStore } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import {
  createControllerProfileStore,
  readControllerProfile,
  type ControllerProfileState,
} from './controller-profile.store.shared.ts';

// MMKV, instance id `game` (G03 08-handoff.md § Data). Its reads are
// synchronous, so the very first frame already knows the profile.
const storage = createMMKV({ id: 'game' });
export const controllerProfileStore = createControllerProfileStore(storage, readControllerProfile(storage));

export function useControllerProfile<T>(selector: (state: ControllerProfileState) => T): T {
  return useStore(controllerProfileStore, selector);
}

/** Actions for the settings screen and tests, outside React render. */
export const controllerProfileActions = {
  set: controllerProfileStore.getState().set,
  reset: controllerProfileStore.getState().reset,
};
