// The adapter: wires the platform's hardware source to one GameInputRouter
// (Master Directive v2 §9 "Keyboard and hardware-gamepad adapters", §10
// "XR and hardware gamepads"). This file owns the lifecycle: it picks the
// platform source, mounts the adapter, and forwards native AppState
// backgrounding. Disconnects and web focus loss are handled in the adapter.
//
// Device state lives in hardware-input.store.ts, never in React state. The
// mapping states, per-device held sets and hold timers live in the pure
// hardware-input-adapter.ts, which node tests drive with a fake source.
import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import type { ControllerProfile, GameInputRouter, PillState } from '../contract.ts';
import { getHardwareInputSource } from './get-hardware-input-source';
import { createHardwareInputAdapter } from './hardware-input-adapter.ts';
import { hardwareInputStore } from './hardware-input.store.ts';

/** Options for {@linkcode useHardwareInput}. Read on every event, so changing them never resubscribes. */
export interface UseHardwareInputOptions {
  /** Dead zone, sensitivity and stick mode for the left stick and d-pad. */
  readonly profile: ControllerProfile;
  /** What a short press of Start / Enter / Escape means right now. */
  readonly pill: PillState;
  /** `false` detaches from the platform (lobby, settings). Default `true`. */
  readonly enabled?: boolean;
}

/**
 * Subscribes the platform's gamepads and hardware keyboard to `router` for
 * as long as the component is mounted and `enabled`. Each source (`gamepad`,
 * `keyboard`) keeps strict down/up pairing on its own, the router keeps it
 * across sources. A disconnect releases what that device held; the last
 * hardware device leaving calls `cancelAll('source-disconnected')`;
 * backgrounding (native) `cancelAll('background')`, blur or a hidden tab
 * (web) `cancelAll('focus-loss')`; the touch overlay reads
 * {@linkcode selectIsHardwareSourceActive} to hide while hardware drives.
 *
 * Unmounting releases only what this adapter holds (its buttons up, its
 * stick ended) and leaves touch alone; the screen's own `cancelAll` covers
 * the transition.
 *
 * @example
 * ```ts
 * useHardwareInput(router, { profile, pill, enabled: screen === 'game' });
 * ```
 */
export function useHardwareInput(router: GameInputRouter, options: UseHardwareInputOptions): void {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) return undefined;
    const store = hardwareInputStore.getState();
    const source = getHardwareInputSource();
    store.setAvailable(source !== null && source.isAvailable);
    if (source === null || !source.isAvailable) return undefined;

    const adapter = createHardwareInputAdapter({
      router,
      source,
      getOptions: () => latest.current,
      store: hardwareInputStore.getState(),
      getActiveSource: () => hardwareInputStore.getState().activeSource,
    });

    const appState =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (status: AppStateStatus) => {
            if (status !== 'active') adapter.interrupt('background');
          });

    return () => {
      appState?.remove();
      adapter.dispose();
    };
  }, [router, enabled]);
}
