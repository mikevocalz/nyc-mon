// world/vd-lean.ts — opt-in "lean" tree LOD for the vd lane
// (EXPO_PUBLIC_WORLD_VD_LEAN=1). Default OFF; unset is off.
//
// Why it exists: on the Surface Duo the vd trees were most of the frame's
// triangles (GAME_PERF 2026-11: ~611k tris, ~60 draws, render() p50 ~22 ms
// at the 2-vsync lock). Under lean the mid tier writes through the shared
// far cross-card imposter pool — ~8 triangles a tree instead of ~900, and
// the six per-species card meshes plus the merged mid trunk sit at count 0
// — while the near cap halves to VD_LEAN_NEAR_TREE_CAP. The far geometry,
// the `over` plain crowns and the default path are untouched.
import { parseSkyRigFlag } from './sky-rig.ts';

/** Opt-in lean tree LOD — default OFF, the same truthy set the other world lanes use. */
export const VD_LEAN = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_VD_LEAN);

/** Near cap under VD_LEAN: half of VD_NEAR_TREE_CAP — two dozen full models still ring the Caller. */
export const VD_LEAN_NEAR_TREE_CAP = 24;
