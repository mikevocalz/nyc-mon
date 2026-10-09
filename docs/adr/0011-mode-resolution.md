# ADR 0011: Scene mode resolution

- **Status:** Proposed
- **Date:** 2026-10-08
- **Deciders:** Mike (creator) signs off; the spatial Contract agent implements (PR A)
- **Builds on:** ADR 0010
- **Code:** `packages/core/sim/scene-mode.ts`, tests in `packages/core/test/scene-mode.test.ts`

## Context

The same Mon runs on Quest 3, on a phone and on the web. Each surface supports different presentations, and a headset supports different ones depending on what the runtime reports and what the Caller has scanned. The brief fixes the degradation order: room without scene anchors becomes tabletop; tabletop without a table anchor becomes a floor-placed tabletop; no scene model at all becomes `screen` (a flat Horizon window); phone is `screen`; web is `preview`. `street` exists in the type and is never chosen in Phase 1.

The Viro fork reports runtime facts through `ViroOpenXRRuntimeCapabilities` (`@reactvision/react-viro` `dist/components/Utilities/VRModuleOpenXR.d.ts`), returned by `VRModuleOpenXR.getRuntimeCapabilities(viewTag)` and `getOpenXRRuntimeCapabilities(viewTag)`. Both resolve `null` until the immersive view initialises or when the backend is not OpenXR. The fork's platform flags live in `dist/components/Utilities/ViroPlatform.d.ts`; it marks `isQuest` and `isKnownQuest` as diagnostic only and says to feature-detect instead.

## Decision

`resolveSceneMode(input: SceneModeInput): ResolvedSceneMode` is a pure function in core.

**Inputs**

- `platform: 'headset' | 'phone' | 'web'`. The app maps `isXRHeadset` → `headset`, `isWeb` → `web`, else `phone`. Model flags never feed it.
- `capabilities: SceneRuntimeCapabilities | null`, with the fork's own field names: `planeDetectionAvailable`, `sceneUnderstandingAvailable`, `localFloorAvailable`, `handTrackingAvailable`. The fork type is structurally assignable, so core does not import Viro.
- `anchors: SceneAnchors | undefined` (ADR 0010).
- `preference: 'room' | 'tabletop' | 'screen'`, the Caller's choice. It is a preference: the resolver degrades it and never throws.

**Rules**

- A "scene model" exists when the runtime reports `sceneUnderstandingAvailable` or `planeDetectionAvailable`. Without one, anchors are ignored as stale.
- `room` needs a floor anchor and a wall anchor. A Mon that walks a room needs both the ground and a boundary.
- A tabletop stands on the table anchor if there is one, else on the floor: a floor anchor or LOCAL_FLOOR (`localFloorAvailable`). LOCAL_FLOOR alone is enough because it puts the floor at y = 0.
- No usable anchor and no LOCAL_FLOOR means no scene model at all: `screen`.
- H-Lynk: `app` whenever the mode is `screen` or `preview`. In `room` and `tabletop`, `wrist_panel` when hands are tracked (the wrist joint comes from `ViroHandUpdateEvent`, `dist/components/Types/ViroEvents.d.ts:142-185`), else `hand_panel` on the controller.
- Every result carries a `reason`, one per row below, for logs and QA.
- Every result carries `placement` (`'table' | 'floor'` in `tabletop`, `'floor'` in `room`, `null` in flat modes) and `anchors`: the usable anchors in immersive modes, `undefined` in flat modes. `buildMonSceneInput` takes this result whole (ADR 0010), so the scene cannot carry anchors the resolver rejected.

### Matrix

| # | Platform | Capabilities | Usable anchors | Preference | Mode | Tabletop on | H-Lynk | `reason` |
|---|---|---|---|---|---|---|---|---|
| 1 | phone | any | any | any | `screen` | — | `app` | `phone` |
| 2 | web | any | any | any | `preview` | — | `app` | `web` |
| 3 | headset | `null` | any | any | `screen` | — | `app` | `no-capabilities` |
| 4 | headset | set | any | `screen` | `screen` | — | `app` | `preferred-screen` |
| 5 | headset | set | floor + wall | `room` | `room` | — | wrist / hand | `room-anchors` |
| 6 | headset | set | table, missing floor or wall | `room` | `tabletop` | table | wrist / hand | `room-without-scene-anchors` |
| 7 | headset | set, LOCAL_FLOOR or floor anchor | no table, missing floor or wall | `room` | `tabletop` | floor | wrist / hand | `room-without-scene-anchors` |
| 8 | headset | set | table | `tabletop` | `tabletop` | table | wrist / hand | `table-anchor` |
| 9 | headset | set, LOCAL_FLOOR or floor anchor | no table | `tabletop` | `tabletop` | floor | wrist / hand | `no-table-anchor` |
| 10 | headset | set, no LOCAL_FLOOR | no table, no floor | `room` or `tabletop` | `screen` | — | `app` | `no-scene-model` |

"Wrist / hand" is `wrist_panel` when `handTrackingAvailable`, else `hand_panel`. Row 10 also covers a runtime with neither scene feature: its anchors are dropped, so only LOCAL_FLOOR can save it (row 7 or 9).

**Tests.** One `it.each` row per matrix row, plus the edge rows (plane detection alone counts as a scene model; stale anchors without a scene capability are ignored). A second suite runs the full cartesian product of inputs (3 platforms × 3 preferences × 2⁹ capability and anchor combinations = 4,608) and asserts the invariants: never `street`; `app` exactly when not immersive; only a headset is immersive; `wrist_panel` exactly when hands are tracked; `room` only with the room preference, floor and wall anchors and a scene model; a `screen` preference always wins on a headset.

## Options considered

### Option A: pure resolver over runtime facts (chosen)

Feature detection, as the fork asks. Every row is a unit test. The headset model never appears.

### Option B: branch on headset identity (`isQuest`, model strings)

Rejected. The fork documents that Horizon compatibility mode can report a Quest identity on other hardware, and capability varies with what the Caller scanned, not only with the model.

### Option C: throw when the preference cannot be met

Rejected. The preference is best-effort and the Mon can always be shown somewhere. The `reason` tells the UI when to explain the downgrade.

## Consequences

- The capability probe is asynchronous and may resolve `null`. The app resolves with `null` first (`screen`) and re-resolves when the probe answers.
- Re-scanning the room changes anchors and so the mode; the resolver is cheap enough to run on every anchor update.
- Phase 2 adds `street` by adding a preference and a row, not by changing renderers.
