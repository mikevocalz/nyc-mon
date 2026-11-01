'use client';

import { useId, useLayoutEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import type {
  CreatureFraming, CreaturePerformance, DeviceKey, DeviceScreen, HLynkShellProps, HLynkStatus, ShellTrackpadProps, StillReaction,
} from '@acme/ui';

/**
 * The shell chrome a `/(home)` route asks for. The shell itself is mounted
 * once, in `/(home)/_layout.tsx`, so M11 → M12 → M09 → M13 never remounts the
 * shell or the creature (M12 continuity rule); each route only describes it.
 */
export interface HomeChrome {
  readonly status: HLynkStatus;
  readonly scheme: 'daylit' | 'night';
  readonly trackpad: ShellTrackpadProps;
  readonly keys?: HLynkShellProps['keys'];
  readonly statusRow?: ReactNode;
  readonly layout?: HLynkShellProps['layout'];
  readonly testIDPrefix: string;
  /** Whether the creature layer draws the Mon. False while the egg is still in its case. */
  readonly creature: boolean;
  readonly framing: CreatureFraming;
  readonly performance?: CreaturePerformance;
  /** A still reaction (tilt or lift); bump `key` to play it once. */
  readonly reaction?: { readonly kind: StillReaction; readonly key: number };
}

/** One route's contribution to the stage. */
export interface HomeStageEntry {
  /** Shell routes describe the chrome; bare routes (M17, M18, "Shell: none") leave it out. */
  readonly chrome?: HomeChrome;
  /** Drawn inside the H-Lynk screen, over the creature layer. */
  readonly screen?: ReactNode;
  /** Side panes on wide windows (`HLynkStage`). */
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  /**
   * The route draws its own full-window 3D H-Lynk in the slot layer (M11 on
   * the 3D stage): the layout unmounts the 2D shell while it is set. Leave
   * `chrome` out with it.
   */
  readonly immersive?: boolean;
}

/**
 * A route's screen on the persistent 3D H-Lynk (HomeLayout's one stage):
 * what the glass draws and selects, and what the device keys do.
 */
export interface GlassRoute {
  readonly owner: string;
  readonly screen: DeviceScreen;
  readonly label: string;
  readonly onKey: (key: DeviceKey) => void;
  /** A drag on the 3D trackpad, pt (M13's room pan); unset: the trackpad does not pan. */
  readonly onPan?: (dxPt: number, dyPt: number) => void;
}

interface HomeStageState extends HomeStageEntry {
  readonly owner: string | null;
  /** True while a bare route is on top: the route draws full-window over the mounted shell. */
  readonly bare: boolean;
  readonly menuOpen: boolean;
  /** Bumped by the shell's H-LYNK tab; Home opens the device menu once per bump. Route cleanup never resets it. */
  readonly menuRequest: number;
  readonly immersive: boolean;
  /** The shared 3D companion stage reported no GPU backend: the 2D shell is the fallback from then on. */
  readonly glassFailed: boolean;
  /**
   * Which failure it was (M22): the stage never got a backend
   * (`webgpu-unavailable`) or had one and lost it (`context-lost`). Bumped
   * with `glassFailureSeq` so the layout routes to M22 once per failure.
   */
  readonly glassFailure: 'webgpu-unavailable' | 'context-lost' | null;
  readonly glassFailureSeq: number;
  /** The route screen on the persistent 3D H-Lynk now, or null (the stage shows the Baby and its name). */
  readonly glass: GlassRoute | null;
  /** The route's companion pane on tablet-class windows (GlassStage `companion`), or null. */
  readonly companion: { readonly owner: string; readonly node: ReactNode } | null;
  /**
   * The device's box inside the stage host while a companion pane shares it,
   * host-local pt; null when the device has the whole host. Overlays that
   * belong to the device (M09's name field) sit inside it.
   */
  readonly stageFrame: StageFrame | null;
}

/** A box inside the stage host, pt from its top-left. */
export interface StageFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const EMPTY: HomeStageState = {
  owner: null,
  bare: false,
  menuOpen: false,
  menuRequest: 0,
  immersive: false,
  glassFailed: false,
  glassFailure: null,
  glassFailureSeq: 0,
  glass: null,
  companion: null,
  stageFrame: null,
  chrome: undefined,
  screen: undefined,
  leading: undefined,
  trailing: undefined,
};

/** Read by the layout's shell host; written only through {@linkcode useHomeStage}. */
export const useHomeStageStore = create<HomeStageState>()(() => EMPTY);

/** A route puts its screen on the persistent stage (GlassStage), in place: nothing remounts. */
export function publishGlass(route: GlassRoute): void {
  useHomeStageStore.setState({ glass: route });
}

/** The route left: the stage keeps running and shows the Baby until the next route publishes. */
export function clearGlass(owner: string): void {
  if (useHomeStageStore.getState().glass?.owner === owner) useHomeStageStore.setState({ glass: null });
}

/** A route's companion pane, republished on every render of the route (the stage host re-renders, the route does not). */
export function publishCompanion(owner: string, node: ReactNode): void {
  useHomeStageStore.setState({ companion: { owner, node } });
}

export function clearCompanion(owner: string): void {
  if (useHomeStageStore.getState().companion?.owner === owner) useHomeStageStore.setState({ companion: null });
}

/** The stage host reports where the device sits; skipped when nothing moved. */
export function setStageFrame(frame: StageFrame | null): void {
  const prev = useHomeStageStore.getState().stageFrame;
  const same = prev === frame || (prev !== null && frame !== null
    && prev.x === frame.x && prev.y === frame.y && prev.width === frame.width && prev.height === frame.height);
  if (!same) useHomeStageStore.setState({ stageFrame: frame });
}

export function setGlassFailed(kind: 'webgpu-unavailable' | 'context-lost' = 'webgpu-unavailable'): void {
  const st = useHomeStageStore.getState();
  if (st.glassFailed) return;
  useHomeStageStore.setState({ glassFailed: true, glassFailure: kind, glassFailureSeq: st.glassFailureSeq + 1 });
}

/** M22 "Try 3D again": clears the failure. The caller remounts `(home)` so every route starts a fresh stage. */
export function retryGlass(): void {
  useHomeStageStore.setState({ glassFailed: false, glassFailure: null });
}

/** The shell's H-LYNK tab: ask Home to open the device menu (survives the route change). */
export function requestHomeMenu(): void {
  useHomeStageStore.setState({ menuRequest: useHomeStageStore.getState().menuRequest + 1 });
}

export function setHomeMenuOpen(open: boolean): void {
  useHomeStageStore.setState({ menuOpen: open });
}

/**
 * Publishes a route's chrome and in-screen content to the layout's shell host.
 * Call on every render of the route: the host re-renders, the route does not
 * (the host is a sibling of the router slot), so this never loops. Published
 * before paint, cleared on unmount only if this route still owns the stage.
 */
export function useHomeStage(entry: HomeStageEntry): void {
  const owner = useId();
  useLayoutEffect(() => {
    useHomeStageStore.setState({
      owner,
      bare: entry.chrome === undefined,
      chrome: entry.chrome ?? useHomeStageStore.getState().chrome,
      screen: entry.screen,
      leading: entry.leading,
      trailing: entry.trailing,
      immersive: entry.immersive === true,
    });
  });
  useLayoutEffect(
    () => () => {
      if (useHomeStageStore.getState().owner === owner) {
        useHomeStageStore.setState({ owner: null, bare: false, screen: undefined, leading: undefined, trailing: undefined, menuOpen: false, immersive: false });
      }
    },
    [owner],
  );
}
