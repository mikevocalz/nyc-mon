// Lane C: Valdrada's street furniture, roof plant and elevated structures on the bundled tile (everything in bounds).
//
// Source: Valdrada v0.4.0 (github.com/mkturkcan/valdrada @ 2724c79, MIT) run as shipped by
// tooling/city/vd-port/bake-furniture.mjs: city/furnitureKit.js geometry, the claims Valdrada's own Instancer holds after
// world/assemble.js assembled every tile over the square (compiled furniture records, the area parts' drops, the roof
// engine, city/streetNYC.js curb ramps), city/panelArt.js's panel atlas. Drawn by the pooled instancer
// (pool-instancer.ts, after city/instancer.js).
//
// Pools: lamp posts (cobra head + its glow lens; the Bishop's Crook has no record in the square), traffic signal masts
// (pole, arm, heads, lens glass, the three lit lenses claimed red-lit as assemble.js does with no signal clock), the
// pedestrian signals, street-name and sign poles (one-way blades only on one-way streets), hydrants, litter baskets,
// mailboxes, bus shelters, subway entrances, Link kiosks, scaffolding sheds, benches, bike racks, news boxes, cones,
// dumpsters, food carts, tree-pit guards, curb ramps, and the roof plant (water towers, bulkheads, AC, vents, fans,
// chimneys, dishes, cell sites, guardrails, ...).
//
// Registered with the cell streamer as resident (ctx.register(mesh, null)): a pool is one draw for the whole square
// that culls its own instances every camera move (Valdrada's instancer does the same; cutting a pool into cells would
// multiply its draws by the cell count). The lamp light spots are exported for the night lights (vdLampSites).
import type { Three } from '@acme/ui/three';
import type { VdPortCtx, VdPortPart } from '../types.ts';
import { decodeAtlas } from './pool-data.ts';
import { createPoolInstancer, type PoolInstancer } from './pool-instancer.ts';
import { VD_POOLS } from './data/instances.ts';
import { VD_POOL_GEOMETRY, VD_POOL_LOD } from './data/geometry.ts';
import { VD_PANEL_ATLAS } from './data/panel-atlas.ts';
import { VD_LAMP_SPOTS } from './data/lamps.ts';

type Texture = InstanceType<Three['Texture']>;

/** A street light Valdrada hangs on a pole: its head position (ground-relative y), N11 fixture kind, height and arm yaw. */
export interface VdLampSite {
  x: number;
  /** Over the ground; add groundY(x, z). */
  y: number;
  z: number;
  /** world/night11.js FIXTURES index: 0 LED 3000 K, 1 LED 4000 K, 2 sodium, 3 acorn; -1 legacy. */
  kind: number;
  /** Luminaire mounting height, metres. */
  head: number;
  /** Arm yaw for a cobra head's throw; null for a round throw. */
  yaw: number | null;
}

/** city/props.js L296/L300 lamp spots over the baked poles. */
export function vdLampSites(): VdLampSite[] {
  const out: VdLampSite[] = [];
  for (let i = 0; i + 5 < VD_LAMP_SPOTS.length; i += 6) {
    const yaw = VD_LAMP_SPOTS[i + 5]!;
    out.push({ x: VD_LAMP_SPOTS[i]!, y: VD_LAMP_SPOTS[i + 1]!, z: VD_LAMP_SPOTS[i + 2]!, kind: VD_LAMP_SPOTS[i + 3]!, head: VD_LAMP_SPOTS[i + 4]!, yaw: Number.isNaN(yaw) ? null : yaw });
  }
  return out;
}

function panelAtlas(THREE: Three, physical: boolean): Texture {
  const t = new THREE.DataTexture(decodeAtlas(VD_PANEL_ATLAS), VD_PANEL_ATLAS.width, VD_PANEL_ATLAS.height, THREE.RGBAFormat);
  // panelArt.js L201-L208: sRGB, anisotropy 8, mipmapped, clamped
  t.colorSpace = physical ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.name = 'vd-port:panel-atlas';
  t.needsUpdate = true;
  return t;
}

export function build(ctx: VdPortCtx): VdPortPart {
  const { THREE } = ctx;
  const atlas = panelAtlas(THREE, ctx.physical);
  const pools: PoolInstancer = createPoolInstancer(THREE, ctx.group, {
    pools: VD_POOLS,
    geometry: VD_POOL_GEOMETRY,
    lod: VD_POOL_LOD,
    groundY: ctx.groundY,
    night: ctx.night,
    physical: ctx.physical,
    atlas,
  });
  for (const m of pools.meshes) ctx.register(m, null);
  let triangles = 0;
  for (const p of VD_POOLS) triangles += (VD_POOL_GEOMETRY[p.name]?.triangles ?? 0) * p.count;
  return {
    dispose() {
      pools.dispose();
      atlas.dispose();
    },
    stats: { meshes: pools.meshes.length, triangles, structures: 0 },
  };
}
