'use client';
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { EMPTY_SAVED_LAYOUTS } from '@acme/ui/game-controls/layout/parts';
import {
  createControllerLayoutStore,
  readControllerLayouts,
  type ControllerLayoutState,
  type ControllerLayoutStorage,
} from './controller-layout.store.shared.ts';

/** localStorage behind MMKV's shape. Absent while Next renders on the server. */
const storage: ControllerLayoutStorage = {
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
};

/**
 * The store opens on the DEFAULTS even in the browser, where the saved value
 * is already readable: the server had no localStorage and rendered default
 * positions into the HTML, so a client store that disagreed on its first
 * render would be a hydration mismatch. The saved map is adopted one effect
 * later, one frame of defaults instead of a React error.
 */
export const controllerLayoutStore = createControllerLayoutStore(storage, EMPTY_SAVED_LAYOUTS);
let adopted = false;

function adoptSaved() {
  if (adopted) return;
  adopted = true;
  const saved = readControllerLayouts(storage);
  if (saved !== EMPTY_SAVED_LAYOUTS) controllerLayoutStore.setState({ layouts: saved });
}

export function useControllerLayout<T>(selector: (state: ControllerLayoutState) => T): T {
  useEffect(adoptSaved, []);
  return useStore(controllerLayoutStore, selector);
}

/** Actions for gesture handlers and the settings screen, outside React render. */
export const controllerLayoutActions = {
  setOffset: controllerLayoutStore.getState().setOffset,
  setScale: controllerLayoutStore.getState().setScale,
  reset: controllerLayoutStore.getState().reset,
};
