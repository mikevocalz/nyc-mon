'use client';
import { createMMKV } from 'react-native-mmkv';
import { useStore } from 'zustand';
import { createWorldSaveStore, readOrMintDeviceId, readWorldSaveSnapshot, type WorldSaveState } from './world-save.store.shared.ts';

// MMKV instance id `world` (react-native-mmkv 4.3.2: `createMMKV` in
// lib/index.d.ts; `getString`/`set`/`remove` in lib/specs/MMKV.nitro.d.ts).
// Its own instance, apart from `nyc-mon-save`: the world save is written on
// a cadence while the Game tab is open, the Mon save is not, and neither
// write may ever clobber the other.
//
// The read is synchronous and happens at module load, so the lobby's first
// render already knows whether START says "Continue your game".
const storage = createMMKV({ id: 'world' });

export const worldSaveStore = createWorldSaveStore(storage, readWorldSaveSnapshot(storage));

export function useWorldSave<T>(selector: (state: WorldSaveState) => T): T {
  return useStore(worldSaveStore, selector);
}

/** This H-Lynk's world device id, persisted on first read. */
export function worldDeviceId(): string {
  return readOrMintDeviceId(storage);
}
