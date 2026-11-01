'use client';
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { DEFAULT_CONTROLLER_PROFILE } from '@acme/ui/game-controls/parts';
import {
  createControllerProfileStore,
  readControllerProfile,
  type ControllerProfileState,
  type ControllerProfileStorage,
} from './controller-profile.store.shared.ts';

/** localStorage behind MMKV's shape. Absent while Next renders on the server. */
const storage: ControllerProfileStorage = {
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
};

/**
 * The store opens on the DEFAULTS even in the browser, where the saved value
 * is already readable: the server had no localStorage and rendered the
 * default profile into the HTML, so a client store that disagreed on its
 * first render would be a hydration mismatch. The saved profile is adopted
 * one effect later, one frame of defaults instead of a React error.
 */
export const controllerProfileStore = createControllerProfileStore(storage, DEFAULT_CONTROLLER_PROFILE);
let adopted = false;

function adoptSaved() {
  if (adopted) return;
  adopted = true;
  const saved = readControllerProfile(storage);
  if (saved !== DEFAULT_CONTROLLER_PROFILE) controllerProfileStore.setState({ profile: saved });
}

export function useControllerProfile<T>(selector: (state: ControllerProfileState) => T): T {
  useEffect(adoptSaved, []);
  return useStore(controllerProfileStore, selector);
}

/** Actions for the settings screen and tests, outside React render. */
export const controllerProfileActions = {
  set: controllerProfileStore.getState().set,
  reset: controllerProfileStore.getState().reset,
};
