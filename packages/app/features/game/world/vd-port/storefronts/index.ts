// Lane B: every storefront Valdrada builds inside the bundled tile (Valdrada @ 2724c79, github.com/mkturkcan/valdrada,
// MIT), from the plan tooling/city/bake-vd-storefronts.mjs bakes:
//
//   - the measured fronts of fk/specs (125th Street and its corners): shop doors, glazing, roll-down gates, awnings and
//     the signs with the names Valdrada recorded, through facadeKit's storeBay / entranceBay / awning (emit.ts);
//   - namedShops.js NAMED_FRONTS (Amsterdam Ave at W 120th St): Hartley Chemist, Hartley Pharmacy, Sliced, Suzi
//     Confections, the Appletree shops, Dunkin', the tower entrance and the spa;
//   - every other storefront building's units (world/nycDress.js through src/kit.js K.storefront). Valdrada letters
//     those signs from an invented roster and leaves most gates up; it has no record of the shop, so here the gate is
//     down and the sign band blank: no invented name.
//
// Gates: by day each measured gate stands where Valdrada photographed it (gate.down); after dark (ctx.night >= 0.5)
// every gate is down. Valdrada keeps its gates at the measured position at every hour; the night closing is this
// port's, asked for by the owner.
//
// Not ported (no data, or not storefront): fasciaAtlas.js, shopSigns.js, signArt.js, adArt.js, billboards.js and
// panelArt.js draw invented names, brands and Times Square boards (none in bounds); decals.js tags and posters are
// procedural (owner rule: nothing Valdrada's data does not hold). See emit.ts for the builders' left-out parts.
//
// One mesh per material for the tile, registered with the cell streamer, which cuts it into 256 m chunks (so the
// storefronts are merged per material per chunk, a draw each). Static: matrixAutoUpdate off, no per-frame work.
import type { Three } from '@acme/ui/three';
import { EMPTY_PART, type VdPortCtx, type VdPortPart, type VdStreamLayer } from '../types.ts';
import { emitPlan, EXTRA, SLOTS, type EmitResult, type Slot } from './emit.ts';
import { FASCIA_ATLAS_HEIGHT, FASCIA_ATLAS_R8, FASCIA_ATLAS_WIDTH } from './fascia-atlas.generated.ts';
import { createStorefrontMaterials } from './materials.ts';
import { VD_STOREFRONT_PLAN } from './plan.generated.ts';

type Mesh = InstanceType<Three['Mesh']>;

/**
 * Streaming, as Valdrada's levels: the far level streams like the city's street detail (cell-stream.ts CELL_LAYERS
 * 'city:street-detail': 256 m chunks, the dither fade). The near level reaches what Valdrada's does:
 * facadeKit's near level shows within 120 m (?fklod) and the dresser builds its units for the 48 nearest buildings
 * within 150 m (nycDress.js MAX_DRESS, DRESS_R), about 100 m of a commercial street either way; on the harness's
 * K (0.3 m reaches 330 m, cell-stream.ts) 0.09 m is 100 m, in 128 m chunks so the reach is not a 256 m square's corner away.
 */
// (0.2 m: 220 m on the harness's K. At the street detail's 0.25 m, 275 m, the far level's chunks at the edge of the
// 360 m resident radius tipped the 125th walk's residency between visits and its triangle budget; the signs and
// gates are read well inside 220 m.)
const FAR_LEVEL: VdStreamLayer = { errorM: 0.2, chunk: 256, fade: true };
// The glass is resident (the persistent tier, one draw for the tile): 5 k triangles, and a transparent pass per chunk
// would spend the cell draw budget on panes.
const LAYER: Record<Slot, VdStreamLayer | null> = { paint: FAR_LEVEL, glass: null, detail: { errorM: 0.09, chunk: 128, fade: true } };

export const VD_STOREFRONT_LAYERS = LAYER;

/** The openings the blocks' walls leave for the spec'd stores (facadeKit `holes`), for lane A. */
export function storefrontHoles(groundY: (x: number, z: number) => number = () => 0): EmitResult['holes'] {
  return emitPlan(VD_STOREFRONT_PLAN, groundY, (f) => f.src === 0).holes;
}

/**
 * The plan is baked for the bundled tile (harlem-apollo.json's origin). Another dataset (a test fixture, a future tile)
 * maps Valdrada's points elsewhere: checked through the ctx's own transform, so nothing is built off its street.
 */
export function planFitsTile(toScene: VdPortCtx['toScene']): boolean {
  const f = VD_STOREFRONT_PLAN.fronts[0];
  if (!f) return false;
  const [x, z] = toScene(f.vp0[0]!, f.vp0[1]!);
  return Math.hypot(x - f.p0[0]!, z - f.p0[1]!) < 0.05;
}

export function build(ctx: VdPortCtx): VdPortPart {
  if (!planFitsTile(ctx.toScene)) return EMPTY_PART;
  const { THREE } = ctx;
  const result = emitPlan(VD_STOREFRONT_PLAN, (x, z) => ctx.groundY(x, z), (f) => ctx.inBounds(f.p0[0]!, f.p0[1]!));
  const mats = createStorefrontMaterials(THREE, ctx.night, ctx.physical, FASCIA_ATLAS_R8, FASCIA_ATLAS_WIDTH, FASCIA_ATLAS_HEIGHT);
  const meshes: Mesh[] = [];
  let triangles = 0;
  for (const slot of SLOTS) {
    const B = result.buffers[slot];
    if (B.position.length < 9) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(B.position, 3));
    // flat shaded from derivatives (materials.ts): no normal; colour and roughness as unorm8x4
    const vc = new Uint8Array(B.color.length);
    for (let i = 0; i < B.color.length; i++) vc[i] = Math.round(Math.min(1, Math.max(0, B.color[i]!)) * 255);
    geometry.setAttribute('color', new THREE.BufferAttribute(vc, 4, true));
    for (const [name, size] of Object.entries(EXTRA[slot])) {
      // the sign ground as unorm8x4; the rest float
      if (name === 'aBg') geometry.setAttribute(name, new THREE.BufferAttribute(Uint8Array.from(B.extra[name]!, (v) => Math.round(v * 255)), size, true));
      else geometry.setAttribute(name, new THREE.Float32BufferAttribute(B.extra[name]!, size));
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, mats.bySlot[slot]);
    mesh.name = `vd:storefronts:${slot}`;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.castShadow = slot === 'paint';
    mesh.receiveShadow = slot !== 'glass';
    if (slot === 'glass') mesh.renderOrder = 2;
    ctx.group.add(mesh);
    ctx.register(mesh, LAYER[slot]);
    meshes.push(mesh);
    triangles += B.position.length / 9;
  }
  const count = (k: string) => result.features.filter((f) => f.kind === k).length;
  return {
    dispose() {
      for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); }
      mats.dispose();
    },
    stats: { meshes: meshes.length, triangles, structures: count('door') + count('gate') + count('unit') + count('sign') + count('awning') },
  };
}
