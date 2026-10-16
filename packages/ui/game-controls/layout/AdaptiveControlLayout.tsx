'use client';
// The measuring host for the arcade controller overlay. It owns no control
// and draws no artwork: it measures its own container (size and window
// origin), converts reported folds into container space, resolves the layout
// through the pure resolver and positions three slots at absolute rects.
//
// Tree, over the world the gameplay screen already renders beneath:
//   AdaptiveControlLayout  (flex-1, pointer-events box-none, measures)
//   ├─ stage slot    the clear sightline (optional HUD content, never a control)
//   ├─ stick slot    lane C1's AnalogStick / DigitalDPad
//   ├─ cluster slot  lane C1's ArcadeSixButtons
//   └─ pill slot     lane C1's StartStopPill
//
// `hideTouchControls` unmounts the three control slots while a hardware
// source (gamepad, keyboard) is active; the stage stays, so gameplay keeps its
// sightline and whatever the host draws there (§10 "XR and hardware
// gamepads"), and the optional `restoreTouch` slot renders at the pill's rect
// so a player always has a way back (finding H8). A `cramped` layout (the
// segment cannot hold the arch at the 44 pt floor) unmounts the stick and the
// cluster and keeps the pill, which never scales and always fits: no cap is
// drawn larger than its slot, so none can land on a hinge (finding M3).
// No world-renderer import: this file knows nothing about three.js.
//
// Geometry lives in a per-instance Zustand store (repo rule: never useState),
// read with selectors; a resize or fold updates the store, not a key, so the
// slots' children keep their identity (foldable skill §6).
import { useEffect, useRef, type ReactNode } from 'react';
import { I18nManager, Platform, type HostInstance, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { foldLayoutsFromRegions } from '../../adaptive-panes/fold-layout';
import type { HardwareFamily } from '../../hardware-family';
import { useReservedRegions } from '../../reserved-regions';
import { View } from '../../tw';
import { useAdaptiveNavigationPlacement } from '../../use-adaptive-navigation-placement';
import { useInstanceStore, useStore } from '../../use-instance-store';
import type { ControllerProfile } from '../contract';
import {
  resolveControllerLayout,
  type ControllerLayout,
  type ControllerRuntime,
  type Insets,
  type Rect,
} from './controller-layout-resolver';
import type { SavedControlLayouts } from './revalidate-positions';

/**
 * What a slot renderer receives: its own rect and the whole resolved layout,
 * so a control can size itself from `rect` and read `layout.scale`,
 * `layout.mirrored` or `layout.isRTL` for its internals.
 *
 * @see {@linkcode AdaptiveControlLayoutProps.stick}
 */
export interface ControlSlot {
  readonly rect: Rect;
  readonly layout: ControllerLayout;
}

/** Props of {@linkcode AdaptiveControlLayout}. */
export interface AdaptiveControlLayoutProps {
  /** The one controller profile from the settings store; handedness and scale move geometry. */
  readonly profile: Pick<ControllerProfile, 'handedness' | 'scale'>;
  /**
   * Saved customizations from the app's controller-layout store. They are
   * revalidated against the live metrics on every render; nothing here is
   * applied as-is.
   */
  readonly savedLayouts?: SavedControlLayouts;
  /**
   * Unmount the stick, cluster and pill slots (a hardware input source is
   * active) while keeping the stage. Default false.
   */
  readonly hideTouchControls?: boolean;
  /**
   * Rendered at the pill's rect while {@linkcode AdaptiveControlLayoutProps.hideTouchControls}
   * is true: the affordance that brings the touch controls back.
   */
  readonly restoreTouch?: (slot: ControlSlot) => ReactNode;
  /**
   * Safe-area insets the host has not already consumed. Defaults to the
   * screen's own share under the shell navigation: the top inset always, the
   * bottom only under a rail (a bottom bar already pads it), and neither side
   * the rail sits on.
   */
  readonly insets?: Insets;
  /**
   * Override the detected hardware family. The default is the process-wide
   * family from `useAdaptiveNavigationPlacement`; stories and tests pass one.
   */
  readonly hardwareFamily?: HardwareFamily;
  /** Override the runtime. Defaults from `Platform.OS`; stories simulate native on web. */
  readonly runtime?: ControllerRuntime;
  /** Renders the left (or mirrored) analog stick / D-pad at its rect. */
  readonly stick: (slot: ControlSlot) => ReactNode;
  /** Renders the six-button cluster at its rect. */
  readonly cluster: (slot: ControlSlot) => ReactNode;
  /** Renders the START/STOP pill at its rect. */
  readonly pill: (slot: ControlSlot) => ReactNode;
  /** Optional content over the clear sightline: never a control, never the world itself. */
  readonly stage?: (slot: ControlSlot) => ReactNode;
  /**
   * Called after each render whose resolved layout differs from the previous
   * one, for the settings screen's drag handles and the diagnostics overlay.
   */
  readonly onLayoutResolved?: (layout: ControllerLayout) => void;
}

interface Geometry {
  width: number;
  height: number;
  originX: number;
  originY: number;
}

/**
 * The screen's own share of the safe area under the shell navigation: the top
 * always, the bottom only under a rail (a bottom bar already pads it), and
 * neither side the rail sits on. `railEdge` is a parameter so TypeScript keeps
 * both edges in play even though today's shell policy only produces `right`.
 */
function screenInsets(safeArea: Insets, rail: boolean, railEdge: 'left' | 'right' | null): Insets {
  return {
    top: safeArea.top,
    bottom: rail ? safeArea.bottom : 0,
    left: railEdge === 'left' ? 0 : safeArea.left,
    right: railEdge === 'right' ? 0 : safeArea.right,
  };
}

// The slot is a positioning box, not an element: the control inside owns its
// name and role (finding L16: an `aria-label` on a role-less view is a web
// lint warning and reads as an unnamed group on native).
function Slot({ rect, children }: { rect: Rect; children: ReactNode }) {
  return (
    <View
      className="absolute"
      pointerEvents="box-none"
      // Computed: every rect comes from resolveControllerLayout (hinge-safe region).
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    >
      {children}
    </View>
  );
}

/**
 * Measures its container, resolves the arcade controller layout for the live
 * window, insets, folds and hardware family, and positions the `stick`,
 * `cluster`, `pill` and optional `stage` slots at absolute rects. Touches
 * outside the slots fall through to the world beneath.
 *
 * @see {@linkcode resolveControllerLayout} for the placement policy.
 */
export function AdaptiveControlLayout({
  profile,
  savedLayouts,
  hideTouchControls = false,
  restoreTouch,
  insets: insetsOverride,
  hardwareFamily,
  runtime,
  stick,
  cluster,
  pill,
  stage,
  onLayoutResolved,
}: AdaptiveControlLayoutProps) {
  const safeArea = useSafeAreaInsets();
  const placement = useAdaptiveNavigationPlacement();
  const regions = useReservedRegions();

  // Live container geometry: per-instance store, never a launch-time Dimensions read.
  const geometry = useInstanceStore<Geometry>(() => ({ width: 0, height: 0, originX: 0, originY: 0 }));
  const { width, height, originX, originY } = useStore(geometry);
  const host = useRef<HostInstance>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    // Window origin converts fold geometry (window space) to container space on BOTH axes.
    const apply = (x: number, y: number) => {
      const current = geometry.getState();
      if (current.width !== w || current.height !== h || current.originX !== x || current.originY !== y) {
        geometry.setState({ width: w, height: h, originX: x, originY: y });
      }
    };
    if (host.current?.measureInWindow) host.current.measureInWindow(apply);
    else apply(0, 0);
  };

  const railEdge = placement.rail && placement.position !== 'bottom' ? placement.position : null;
  // foldLayoutsFromRegions converts x only, so subtract y here.
  const folds = foldLayoutsFromRegions(regions, originX).map((f) => ({ ...f, y: f.y - originY }));
  const insets = insetsOverride ?? screenInsets(safeArea, placement.rail, railEdge);

  const layout = resolveControllerLayout({
    width,
    height,
    insets,
    folds,
    railEdge,
    isRTL: I18nManager.isRTL,
    hardwareFamily: hardwareFamily ?? placement.family,
    runtime: runtime ?? (Platform.OS === 'web' ? 'web' : 'native'),
    controller: profile,
    saved: savedLayouts,
  });

  // Report only when the resolved rects change, not on every render.
  const signature = JSON.stringify([layout.profile, layout.stick, layout.cluster, layout.pill, layout.stage, layout.scale]);
  const lastSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!onLayoutResolved || lastSignature.current === signature) return;
    lastSignature.current = signature;
    onLayoutResolved(layout);
  });

  const measured = width > 0 && height > 0;

  return (
    <View
      // Cast: the kit `View` wraps @expo/html-elements' `Div`, whose ref type is the web element, while
      // the native host it renders is a HostInstance with `measureInWindow`. Neither type names the other.
      ref={host as never}
      className="flex-1"
      pointerEvents="box-none"
      onLayout={onLayout}
    >
      {measured && stage ? (
        <Slot rect={layout.stage}>{stage({ rect: layout.stage, layout })}</Slot>
      ) : null}
      {measured && !hideTouchControls ? (
        <>
          {layout.cramped ? null : (
            <>
              <Slot rect={layout.stick}>{stick({ rect: layout.stick, layout })}</Slot>
              <Slot rect={layout.cluster}>{cluster({ rect: layout.cluster, layout })}</Slot>
            </>
          )}
          <Slot rect={layout.pill}>{pill({ rect: layout.pill, layout })}</Slot>
        </>
      ) : null}
      {measured && hideTouchControls && restoreTouch ? (
        <Slot rect={layout.pill}>{restoreTouch({ rect: layout.pill, layout })}</Slot>
      ) : null}
    </View>
  );
}
