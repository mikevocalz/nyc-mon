// world/vd-leandraw.ts — opt-in "lean draws" for the vd lane
// (EXPO_PUBLIC_WORLD_VD_LEANDRAW=1). Default OFF; unset is off.
//
// Why it exists: on the Surface Duo the ~18 ms render() floor under
// VD_LEAN is per-draw JSI submit encode in react-native-webgpu — not
// triangles (~422k, VD_LEAN) and not shader size (VD_LEANMAT). The
// instrumented draw set under lean (docs/performance/vd-lane-2026-10-18
// lineage, node probe on the harlem-apollo tile at the Apollo focus) is:
//
//   12 city batches (masonry, glass, roofs, neon, billboards, landmarks,
//     detail, lettering, shadows, areas, sidewalks, roads)
//    2 sky + ground
//   12-14 vd trees — 10-12 of them the near tier's per-species bark+leaf
//     pairs, plus the merged far leaf/trunk
//    5 street furniture (poles, blades, heads, pools, lettering)
//    4 street props (banded props, transit, transit lights, cars)
//  ~9-13 living-city/caller draws outside world.group
//
// ≈44-48 on device. The only block still paying per-species draws is the
// near tree tier. This lane merges it the way the far tier already merges:
// one instanced bark mesh and one instanced leaf mesh carry all six
// species — a per-vertex `aSp` marks which species each vertex belongs to
// and a per-instance `aSpecies` picks the live one (the vertex stage
// collapses the rest to a degenerate point, positionNode — the shadow
// pass honours it too). The six mid leaves merge the same way, and the
// far trunk cross folds into the far leaf mesh (per-instance aCrown/aBase
// + per-vertex aSolid). 21 vd tree meshes -> 5 objects, and under VD_LEAN
// the visible tree draws go 12-14 -> 3-4: the world lands under the
// 40-draw floor. The default path, VD_LEAN and VD_LEANMAT are untouched
// while this flag is unset.
import { parseSkyRigFlag } from './sky-rig.ts';

/** Opt-in merged-draw path — default OFF, the same truthy set the other world lanes use. */
export const VD_LEANDRAW = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_VD_LEANDRAW);
