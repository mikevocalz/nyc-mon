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
import type { Node } from 'three/webgpu';
import type { VdPortCtx, VdPortPart } from '../types.ts';
import { decodeAtlas } from './pool-data.ts';
import { createPoolInstancer, type PoolInstancer } from './pool-instancer.ts';
import { VD_PANEL_ATLAS, VD_POOL_GEOMETRY, VD_POOL_LOD, VD_POOLS } from './data/pools.ts';
import { VD_LAMP_SPOTS } from './data/lamps.ts';
import { VD_STRUCTURES, VD_VK_TEXTURES } from './data/structures.ts';
import { FURNITURE_ASSETS } from './asset-bytes.ts';
import { createStructures, type FurnitureAssets, type Structures } from './structures.ts';
import { createStdMaterial, type StdDriver } from './std-material.ts';
import { createPbrMaterial, loadPbrTextures, type PbrDescriptor } from './pbr-material.ts';
import { createVkMaterial, type VkDesc } from './vk-materials.ts';

type Texture = InstanceType<Three['Texture']>;
type Material = InstanceType<Three['Material']>;

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

/** The lamp spots: city/props.js L296/L300 over the pooled poles, and pk/props.js L417-L420 over 125th Street's. */
export function vdLampSites(): VdLampSite[] {
  const out: VdLampSite[] = [];
  for (const L of [VD_LAMP_SPOTS, VD_STRUCTURES.lamps]) {
    for (let i = 0; i + 5 < L.length; i += 6) {
      const yaw = L[i + 5]!;
      out.push({ x: L[i]!, y: L[i + 1]!, z: L[i + 2]!, kind: L[i + 3]!, head: L[i + 4]!, yaw: Number.isNaN(yaw) ? null : yaw });
    }
  }
  return out;
}

function panelAtlas(THREE: Three, physical: boolean, rle: ArrayBuffer): Texture {
  const t = new THREE.DataTexture(decodeAtlas(VD_PANEL_ATLAS, rle), VD_PANEL_ATLAS.width, VD_PANEL_ATLAS.height, THREE.RGBAFormat);
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

export interface FurnitureOptions {
  /** The loader of the lane's binary assets: the platform's (asset-bytes*.ts) by default; null builds nothing. */
  assets?: FurnitureAssets | null;
}

/** What `build` hands back beyond the port's part: the pools and structures once their assets are in (tests, perf). */
export interface FurniturePart extends VdPortPart {
  /** Resolves when the pools are built (their assets fetched and decoded). */
  ready: Promise<void>;
  pools(): PoolInstancer | null;
  structures(): Structures | null;
}

/**
 * The pools load from assets/pools.bin and the panel atlas; the structures stream from their packages. Both are Metro
 * assets fetched after the scene builds (the JS bundle carries only their manifests), so the part draws nothing until
 * they arrive and then fills in.
 */
let assetOverride: FurnitureAssets | null | undefined;
/**
 * The assets a world build's lane C reads when its caller passes none (buildCityWorld does not): the GPU harnesses hand
 * in the disk copies (disk-assets.test-support.ts), since Node has no Metro asset route. undefined restores the default.
 */
export function setFurnitureAssets(assets: FurnitureAssets | null | undefined): void {
  assetOverride = assets;
}

let lastPart: FurniturePart | null = null;
/** The part the last build made (harnesses await its `ready`). */
export function lastFurniturePart(): FurniturePart | null {
  return lastPart;
}

export function build(ctx: VdPortCtx, options: FurnitureOptions = {}): FurniturePart {
  const { THREE } = ctx;
  const assets = options.assets === undefined ? (assetOverride !== undefined ? assetOverride : FURNITURE_ASSETS) : options.assets;
  // sim/signals.js runs every signal off one clock; the port's update(timeS) drives it
  const clock = THREE.TSL.uniform(0) as unknown as Node<'float'> & { value: number };
  const nightNode = ctx.night as unknown as { value?: number };
  let pools: PoolInstancer | null = null;
  let atlas: Texture | null = null;
  let structures: ReturnType<typeof buildStructures> | null = null;
  let disposed = false;
  let triangles = 0;
  for (const p of VD_POOLS) triangles += (VD_POOL_GEOMETRY[p.name]?.triangles ?? 0) * p.count;
  const stats = { meshes: 0, triangles, structures: VD_STRUCTURES.cells.length };
  const ready = !assets ? Promise.resolve() : Promise.all([assets.pools(), assets.panelAtlas()]).then(([bytes, rle]) => {
    if (disposed) return;
    atlas = panelAtlas(THREE, ctx.physical, rle);
    pools = createPoolInstancer(THREE, ctx.group, {
      bytes, pools: VD_POOLS, geometry: VD_POOL_GEOMETRY, lod: VD_POOL_LOD,
      groundY: ctx.groundY, night: ctx.night, physical: ctx.physical, atlas, clock,
    });
    for (const m of pools.meshes) ctx.register(m, null);
    stats.meshes = pools.meshes.length;
    structures = buildStructures(ctx, assets);
    const s = structures;
    pools.onCamera((camera) => s.streamer.frame(camera, clock.value));
  });
  const part: FurniturePart = {
    ready,
    pools: () => pools,
    structures: () => structures?.streamer ?? null,
    update(timeS: number) {
      clock.value = timeS;
      structures?.tick(nightNode.value ?? 0, timeS);
    },
    dispose() {
      disposed = true;
      structures?.dispose();
      pools?.dispose();
      atlas?.dispose();
    },
    stats,
  };
  lastPart = part;
  return part;
}

/**
 * The streamed structures: the shared prototypes, the sign atlas and the PBR arrays load once, then the cells stream
 * (structures.ts). Every slot's material is built on first use by its family.
 */
function buildStructures(ctx: VdPortCtx, assets: FurnitureAssets): { streamer: Structures; tick(night: number, t: number): void; dispose(): void } {
  const { THREE } = ctx;
  const drivers: StdDriver[] = [];
  const textures: Texture[] = [];
  let signAtlas: Texture | null = null;
  let pbr: { albedo: InstanceType<Three['DataArrayTexture']>; orm: InstanceType<Three['DataArrayTexture']> } | null = null;
  const vkTex = new Map<string, Texture>();
  const pbrReady = Promise.all([assets.pbrAlbedo(), assets.pbrOrm()]).then(([albedo, orm]) => { pbr = loadPbrTextures(THREE, { albedo, orm }); textures.push(pbr.albedo, pbr.orm); });
  const vkReady = assets.vkTextures().then((buf) => {
    for (const t of VD_VK_TEXTURES) {
      const tex = new THREE.DataTexture(new Uint8Array(buf, t.offset, t.width * t.height * 4), t.width, t.height, THREE.RGBAFormat);
      tex.colorSpace = t.colorSpace === 'srgb' && ctx.physical ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.wrapS = t.wrapS as never; tex.wrapT = t.wrapT as never;
      tex.repeat.set(t.repeat[0], t.repeat[1]);
      tex.anisotropy = t.anisotropy;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      vkTex.set(t.key, tex);
      textures.push(tex);
    }
  });
  const streamer = createStructures(THREE, {
    manifest: VD_STRUCTURES,
    ...(ctx.preset ? { limits: { radiusM: ctx.preset.residentRadiusM, maxVertices: ctx.preset.vdPort.structureVertices } } : {}),
    assets: { ...assets, protos: async () => { const [p] = await Promise.all([assets.protos(), pbrReady, vkReady]); return p; } },
    group: ctx.group,
    onAtlas(bytes) {
      const { width, height } = VD_STRUCTURES.sign;
      const t = new THREE.DataTexture(new Uint8Array(bytes), width, height, THREE.RGBAFormat);
      t.colorSpace = ctx.physical ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = 8;
      t.name = 'vd-port:sign-atlas';
      t.needsUpdate = true;
      signAtlas = t;
      textures.push(t);
    },
    material(desc) {
      if (desc.family === 'pbr') {
        if (!pbr) throw new Error('vd structures: a pbr slot before the PBR arrays');
        return createPbrMaterial(THREE, desc as unknown as PbrDescriptor, { night: ctx.night, physical: ctx.physical, albedo: pbr.albedo, orm: pbr.orm }) as unknown as Material;
      }
      if (desc.family.startsWith('vk')) {
        return createVkMaterial(THREE, desc as unknown as VkDesc, { night: ctx.night, physical: ctx.physical, texture: (k) => vkTex.get(k) ?? null });
      }
      if (!signAtlas) throw new Error('vd structures: a std slot before the sign atlas');
      return createStdMaterial(THREE, desc, { night: ctx.night, physical: ctx.physical, atlas: signAtlas, rects: VD_STRUCTURES.sign.rects }, drivers);
    },
  });
  return {
    streamer,
    tick(night, t) { for (const d of drivers) d.update(night, t); },
    dispose() { streamer.dispose(); for (const t of textures) t.dispose(); },
  };
}
