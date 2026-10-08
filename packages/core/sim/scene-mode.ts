import type { HLynkSurface, SceneAnchors } from '../types/index.ts';
import { assertNever } from './assert-never.ts';

/**
 * The device class a scene runs on. The app maps the Viro fork's flags to it:
 * `isXRHeadset` → `headset`, `isWeb` → `web`, otherwise `phone`
 * (`@reactvision/react-viro` `dist/components/Utilities/ViroPlatform.d.ts`).
 * Model flags (`isQuest`, `isKnownQuest`) never feed this; the fork marks them
 * diagnostic only.
 */
export type ScenePlatform = 'headset' | 'phone' | 'web';

/**
 * The runtime facts the resolver reads, named exactly as the fork's
 * `ViroOpenXRRuntimeCapabilities` (`dist/components/Utilities/VRModuleOpenXR.d.ts`,
 * returned by `VRModuleOpenXR.getRuntimeCapabilities` / `getOpenXRRuntimeCapabilities`).
 * The fork type is structurally assignable to this one, so core never imports Viro.
 */
export interface SceneRuntimeCapabilities {
  readonly planeDetectionAvailable: boolean;
  readonly sceneUnderstandingAvailable: boolean;
  readonly localFloorAvailable: boolean;
  readonly handTrackingAvailable: boolean;
}

/** What the Caller asked for. A preference, not a requirement: the resolver degrades it. */
export type ScenePreference = 'room' | 'tabletop' | 'screen';

/** Input to {@linkcode resolveSceneMode}. */
export interface SceneModeInput {
  readonly platform: ScenePlatform;
  /** `null` while the probe has not resolved, or when the backend is not OpenXR (the fork returns null then). */
  readonly capabilities: SceneRuntimeCapabilities | null;
  /** Absent on phone and web. */
  readonly anchors: SceneAnchors | undefined;
  readonly preference: ScenePreference;
}

/** Why the resolver landed where it did. One value per matrix row (ADR 0011). */
export type SceneModeReason =
  | 'phone'
  | 'web'
  | 'no-capabilities'
  | 'preferred-screen'
  | 'room-anchors'
  | 'room-without-scene-anchors'
  | 'table-anchor'
  | 'no-table-anchor'
  | 'no-scene-model';

/**
 * The resolver's answer. `placement` is what the Mon stands on and `anchors`
 * are only the anchors the resolver accepted, so a renderer cannot place on a
 * surface the resolver rejected. Flat modes carry neither.
 */
export type ResolvedSceneMode =
  | {
      readonly mode: 'screen' | 'preview';
      readonly placement: null;
      readonly anchors: undefined;
      readonly hLynk: 'app';
      readonly reason: SceneModeReason;
    }
  | {
      readonly mode: 'tabletop';
      readonly placement: 'table' | 'floor';
      readonly anchors: SceneAnchors | undefined;
      readonly hLynk: Exclude<HLynkSurface, 'app'>;
      readonly reason: SceneModeReason;
    }
  | {
      readonly mode: 'room';
      readonly placement: 'floor';
      readonly anchors: SceneAnchors;
      readonly hLynk: Exclude<HLynkSurface, 'app'>;
      readonly reason: SceneModeReason;
    };

const flat = (mode: 'screen' | 'preview', reason: SceneModeReason): ResolvedSceneMode => ({
  mode,
  placement: null,
  anchors: undefined,
  hLynk: 'app',
  reason,
});

/**
 * Anchors count only when the runtime has a scene model to have produced
 * them. Stale anchors from a runtime that reports neither feature are ignored.
 */
export function usableAnchors(
  caps: SceneRuntimeCapabilities,
  anchors: SceneAnchors | undefined,
): SceneAnchors | undefined {
  if (!caps.sceneUnderstandingAvailable && !caps.planeDetectionAvailable) return undefined;
  return anchors;
}

/** Immersive H-Lynk placement: on the wrist joint when hands are tracked, else on the hand/controller. */
function immersiveHLynk(caps: SceneRuntimeCapabilities): Exclude<HLynkSurface, 'app'> {
  return caps.handTrackingAvailable ? 'wrist_panel' : 'hand_panel';
}

function tabletopOrScreen(
  caps: SceneRuntimeCapabilities,
  anchors: SceneAnchors | undefined,
  fallbackReason: 'room-without-scene-anchors' | null,
): ResolvedSceneMode {
  const hLynk = immersiveHLynk(caps);
  if (anchors?.table !== undefined) {
    return { mode: 'tabletop', placement: 'table', anchors, hLynk, reason: fallbackReason ?? 'table-anchor' };
  }
  if (anchors?.floor !== undefined || caps.localFloorAvailable) {
    return { mode: 'tabletop', placement: 'floor', anchors, hLynk, reason: fallbackReason ?? 'no-table-anchor' };
  }
  return flat('screen', 'no-scene-model');
}

/**
 * Picks the Phase-1 scene mode and H-Lynk surface (ADR 0011). Pure.
 *
 * - phone → `screen`; web → `preview`; both use the `app` H-Lynk.
 * - headset without capabilities, or preferring `screen` → `screen` (flat Horizon window).
 * - `room` needs floor and wall anchors; without them it degrades to `tabletop`.
 * - `tabletop` stands on the table anchor, else on the floor (floor anchor or LOCAL_FLOOR).
 * - no usable anchors and no LOCAL_FLOOR → `screen`.
 *
 * Never returns `street`.
 */
export function resolveSceneMode(input: SceneModeInput): ResolvedSceneMode {
  switch (input.platform) {
    case 'phone':
      return flat('screen', 'phone');
    case 'web':
      return flat('preview', 'web');
    case 'headset': {
      const caps = input.capabilities;
      if (caps === null) return flat('screen', 'no-capabilities');
      const anchors = usableAnchors(caps, input.anchors);
      switch (input.preference) {
        case 'screen':
          return flat('screen', 'preferred-screen');
        case 'room':
          if (anchors?.floor !== undefined && anchors.wall !== undefined) {
            return { mode: 'room', placement: 'floor', anchors, hLynk: immersiveHLynk(caps), reason: 'room-anchors' };
          }
          return tabletopOrScreen(caps, anchors, 'room-without-scene-anchors');
        case 'tabletop':
          return tabletopOrScreen(caps, anchors, null);
        default:
          return assertNever(input.preference);
      }
    }
    default:
      return assertNever(input.platform);
  }
}
