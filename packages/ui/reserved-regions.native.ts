// Fold and camera geometry for the current window.
//
// Apple: the local ReservedRegions module is an Expo Modules 2 Swift module and
// remains reachable through Expo's native-module compatibility lookup.
// Android: SDK 58's Modules 2 runtime exposes the @ExpoModule object through
// globalThis.expoV2.modules, so this file intentionally does NOT route Android
// through the legacy ModuleDefinition bridge.
//
// Android also emits a native "changed" event from WindowInfoTracker. Window
// dimensions are still a dependency because Activity/configuration replacement
// can create a new native window even when JavaScript survives the transition.
//
// SOT: apps/mobile/modules/reserved-regions
// SOT-KEYWORDS: reserved regions hook folding feature windowmanager expo modules v2 hinge posture native
import { requireOptionalNativeModule } from 'expo';
import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import type { ReservedRegion } from './reserved-regions.types';
import { useInstanceStore, useStore } from './use-instance-store';
import { useReservedRegionsOverride } from './reserved-regions-override';

export type {
  FoldOcclusionType,
  FoldOrientation,
  FoldState,
  ReservedRegion,
} from './reserved-regions.types';

interface NativeSubscription {
  remove(): void;
}

interface ReservedRegionsNative {
  query(): Promise<ReservedRegion[]>;
  addListener?(
    eventName: 'changed',
    listener: (regions: ReservedRegion[]) => void,
  ): NativeSubscription;
}

interface ExpoModulesV2Global {
  expoV2?: {
    modules?: {
      ReservedRegions?: ReservedRegionsNative;
    };
  };
}

const legacyNative = requireOptionalNativeModule<ReservedRegionsNative>('ReservedRegions');
const NONE: readonly ReservedRegion[] = [];

function nativeModule(): ReservedRegionsNative | null {
  const modulesV2 = (globalThis as typeof globalThis & ExpoModulesV2Global).expoV2;
  return modulesV2?.modules?.ReservedRegions ?? legacyNative;
}

export function useReservedRegions(): readonly ReservedRegion[] {
  const override = useReservedRegionsOverride();
  const { width, height } = useWindowDimensions();
  const store = useInstanceStore<{ regions: readonly ReservedRegion[] }>(() => ({ regions: NONE }));
  const regions = useStore(store, (state) => state.regions);

  useEffect(() => {
    const native = override === null ? nativeModule() : null;
    if (!native) return;

    let live = true;
    const setRegions = (next: readonly ReservedRegion[]) => store.setState({ regions: next });
    const accept = (next: ReservedRegion[]) => {
      if (live) setRegions(next);
    };

    // Snapshot first: iOS has no reserved-region change event, and on Android
    // this also rebinds the WindowInfoTracker Flow after Activity replacement.
    void native.query().then(accept).catch(() => {
      if (live) setRegions(NONE);
    });

    // Modules 2 event observation hooks start native Flow collection only while
    // this Android listener exists. iOS deliberately does not subscribe: UIKit
    // exposes no reserved-region change event, so window dimensions remain the
    // signal there exactly as before.
    const subscription =
      Platform.OS === 'android'
        ? native.addListener?.('changed', accept)
        : undefined;

    return () => {
      live = false;
      subscription?.remove();
    };
  }, [width, height, store, override]);

  return override ?? regions;
}
