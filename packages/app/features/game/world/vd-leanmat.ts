// world/vd-leanmat.ts — opt-in "lean materials" for the vd lane
// (EXPO_PUBLIC_WORLD_VD_LEANMAT=1). Default OFF; unset is off.
//
// Why it exists: on the Surface Duo renderer.render() bottoms out at
// ~18 ms p50 over ~48 draws even after VD_LEAN cut the trees to ~422k tris
// — the near=12 probe (docs/performance/present-tail-2026-10-18.md) put
// the floor in the per-draw TSL node-graph encode, spread across the whole
// draw set rather than in any one pool. This lane swaps the shader bodies
// on the biggest draws for unlit MeshBasicNodeMaterial: the vd tree
// materials keep their colour graphs (atlas layer, aShade, display tones)
// minus the lighting model (vd-trees-mesh.ts), and the vd city surfaces
// drop their photo/normal/window graphs for vertex colour or a flat
// palette tone (vd-materials.ts). Geometry, instancing and draw
// consolidation are untouched — only what each draw encodes.
import { parseSkyRigFlag } from './sky-rig.ts';

/** Opt-in lean material path — default OFF, the same truthy set the other world lanes use. */
export const VD_LEANMAT = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_VD_LEANMAT);
